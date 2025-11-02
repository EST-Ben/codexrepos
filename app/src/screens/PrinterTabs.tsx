import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  View,
} from 'react-native';

import {
  analyzeImage as analyzeImageApi,
  exportProfile,
  type RNFileLike,
} from '../api/client';
import { CameraButton, type PreparedImage } from '../components/CameraButton';
import { filterMachines, useMachineRegistry } from '../hooks/useMachineRegistry';
import type {
  AppliedParametersDetails,
  AnalyzeRequestMeta,
  AnalyzeResponse,
  AnalysisHistoryRecord,
  MachineRef,
  MachineSummary,
  ProfileState,
} from '../types';
import { usePrivacySettings } from '../state/privacy';

interface PrinterTabsProps {
  profile: ProfileState & { materialByMachine?: Record<string, string | undefined> };
  onEditProfile(): void;
  onShowAnalysis(payload: {
    machine: MachineRef;
    response: AnalyzeResponse;
    material?: string;
    summary?: MachineSummary;
    image?: { uri: string; width: number; height: number };
  }): void;
  onUpdateMaterial(machineId: string, material: string | undefined): void | Promise<void>;
  onOpenHistory(machine?: MachineRef): void;
  onRecordHistory(entry: AnalysisHistoryRecord): void | Promise<void>;
  historyCounts: Record<string, number>;
}

const MATERIAL_OPTIONS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon'];

const DEFAULT_APP_VERSION = 'printer-page';

function formatConfidence(value?: number): string {
  if (typeof value !== 'number') {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
}

function extractAppliedParameters(
  applied: AnalyzeResponse['applied'],
): Record<string, number | string> {
  if (!applied) {
    return {};
  }
  const maybeDetails = applied as Extract<AnalyzeResponse['applied'], { parameters?: unknown }>;
  if (maybeDetails && typeof maybeDetails === 'object' && 'parameters' in maybeDetails) {
    const params = (maybeDetails as { parameters?: Record<string, number | string> }).parameters;
    return params ? { ...params } : {};
  }
  return { ...(applied as Record<string, number | string>) };
}

function entriesFromRecord(record?: Record<string, number | string>): Array<[string, number | string]> {
  return Object.entries(record ?? {});
}

export const PrinterTabs: React.FC<PrinterTabsProps> = ({
  profile,
  onEditProfile,
  onShowAnalysis: _onShowAnalysis,
  onUpdateMaterial,
  onOpenHistory,
  onRecordHistory,
  historyCounts,
}) => {
  const {
    machines,
    lookup,
    loading: machinesLoading,
    error: machinesError,
    refresh,
  } = useMachineRegistry();
  const { settings, update: updatePrivacy } = usePrivacySettings();
  const [activeMachineId, setActiveMachineId] = useState<string | null>(profile.machines[0]?.id ?? null);
  const [search, setSearch] = useState<string>('');
  const [lastRequest, setLastRequest] = useState<{
    machine: MachineRef;
    material?: string;
    imageUri?: string;
    summary?: MachineSummary;
    image?: { uri: string; width: number; height: number };
  } | null>(null);

  const handleQueueSuccess = useCallback(
    (item, response: AnalyzeResponse) => {
      const summary = lookup.get(item.machine.id);
      const entry: AnalysisHistoryRecord = {
        imageId: response.image_id,
        machineId: item.machine.id,
        machine: item.machine,
        timestamp: Date.now(),
        issues: response.issue_list,
        response,
        material: item.material,
        localUri: settings.storeImagesLocallyOnly ? undefined : item.fileUri,
        summary,
      };
      void onRecordHistory(entry);
    },
    [lookup, onRecordHistory, settings.storeImagesLocallyOnly],
  );

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && previewUrl && previewUrl.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const currentIds = profile.machines.map((item) => item.id);
    if (!activeMachineId || !currentIds.includes(activeMachineId)) {
      setActiveMachineId(currentIds[0] ?? null);
    }
  }, [activeMachineId, profile.machines]);

  useEffect(() => {
    if (isSuccess && data && lastRequest) {
      const entry: AnalysisHistoryRecord = {
        imageId: data.image_id,
        machineId: lastRequest.machine.id,
        machine: lastRequest.machine,
        timestamp: Date.now(),
        issues: data.issue_list,
        response: data,
        material: lastRequest.material,
        localUri: settings.storeImagesLocallyOnly ? undefined : lastRequest.imageUri,
        summary: lastRequest.summary ?? machineSummary,
      };
      void onRecordHistory(entry);
      onShowAnalysis({
        machine: lastRequest.machine,
        response: data,
        material: lastRequest.material,
        summary: lastRequest.summary ?? machineSummary,
        image: lastRequest.image,
      });
      reset();
      setLastRequest(null);
    }
  }, [data, isSuccess, lastRequest, machineSummary, onRecordHistory, onShowAnalysis, reset, settings.storeImagesLocallyOnly]);

  useEffect(() => {
    void retryQueued();
  }, [retryQueued]);

  useEffect(() => {
    if (isSuccess) {
      void retryQueued();
    }
  }, [isSuccess, retryQueued]);

  const activeMachine = useMemo(
    () => profile.machines.find((machine) => machine.id === activeMachineId) ?? null,
    [activeMachineId, profile.machines],
  );

  const machineSummary = activeMachineId ? lookup.get(activeMachineId) : undefined;
  const materialValue = activeMachineId
    ? profile.materialByMachine?.[activeMachineId] ?? profile.material
    : profile.material;

  const historyCount = activeMachineId ? historyCounts[activeMachineId] ?? 0 : 0;

  const filteredSummaries = useMemo(
    () => filterMachines(machines, search),
    [machines, search],
  );

  const handleAnalyze = useCallback(
    async (image: PreparedImage) => {
      if (!activeMachine) {
        return;
      }
      const meta: AnalyzeRequestMeta = {
        machine_id: activeMachine.id,
        experience: profile.experience,
        material: materialValue ?? 'PLA',
        app_version: DEFAULT_APP_VERSION,
      };

      const filePayload: Blob | RNFileLike =
        Platform.OS === 'web' && image.blob ? image.blob : { uri: image.uri, name: image.name, type: image.type };

      if (previewUrl && Platform.OS === 'web' && previewUrl.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(image.uri);
      setPreviewSize({ width: image.width, height: image.height });
      setLoading(true);
      setErrorMessage(null);
      setResult(null);

      try {
        const response = await analyzeImageApi(filePayload, meta);
        setResult(response);

        const summary = lookup.get(activeMachine.id);
        const historyEntry: AnalysisHistoryRecord = {
          imageId: response.image_id ?? `local-${Date.now()}`,
          machineId: activeMachine.id,
          machine: activeMachine,
          timestamp: Date.now(),
          issues: response.issue_list ?? [],
          response,
          material: materialValue,
          localUri: settings.storeImagesLocallyOnly ? undefined : image.uri,
          summary,
        };
        void onRecordHistory(historyEntry);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    },
    [activeMachine, lookup, materialValue, onRecordHistory, previewUrl, profile.experience, settings.storeImagesLocallyOnly],
  );

  const issueList = result?.issue_list ?? [];
  const topIssue = useMemo(() => {
    if (!result) {
      return null;
    }
    if (result.top_issue) {
      return result.top_issue;
    }
    if (result.issue) {
      return result.issue;
    }
    return issueList.length ? issueList[0].id : null;
  }, [issueList, result]);

  const topConfidence = useMemo(() => {
    if (!result) {
      return undefined;
    }
    if (typeof result.confidence === 'number') {
      return result.confidence;
    }
    if (topIssue) {
      const match = issueList.find((entry) => entry.id === topIssue);
      if (match) {
        return match.confidence;
      }
    }
    return issueList.length ? issueList[0]?.confidence : undefined;
  }, [issueList, result, topIssue]);

  const parameterEntries = useMemo(
    () => entriesFromRecord(result?.parameter_targets as Record<string, number | string> | undefined),
    [result?.parameter_targets],
  );

  const appliedParameters = useMemo(() => extractAppliedParameters(result?.applied), [result?.applied]);
  const appliedEntries = useMemo(() => entriesFromRecord(appliedParameters), [appliedParameters]);
  const appliedDetails = (result?.applied as AppliedParametersDetails | undefined) ?? undefined;

  const heatmapUri = result?.heatmap ?? null;
  const boundingBoxes = result?.boxes ?? [];
  const recommendations = result?.recommendations ?? [];
  const capabilityNotes = result?.capability_notes ?? [];
  const clampExplanations = appliedDetails?.explanations ?? result?.clamp_explanations ?? [];
  const hiddenParameters = appliedDetails?.hidden_parameters ?? result?.hidden_parameters ?? [];
  const experienceLevel = appliedDetails?.experience_level;
  const clamped = appliedDetails?.clamped_to_machine_limits;

  const handleExport = useCallback(async () => {
    if (!result) {
      return;
    }
    const meta: AnalyzeRequestMeta = {
      machine_id: activeMachine.id,
      experience: profile.experience,
      material: materialValue,
      app_version: 'app-ai-alpha',
    };
    const summary = lookup.get(activeMachine.id);
    setLastRequest({
      machine: activeMachine,
      material: materialValue,
      imageUri: image.uri,
      summary,
      image: { uri: image.uri, width: image.width, height: image.height },
    });
    const filePayload: Blob | { uri: string; name: string; type: string } =
      image.blob ?? { uri: image.uri, name: image.name, type: image.type };
    mutate({
      file: filePayload,
      meta,
      machine: activeMachine,
      material: materialValue,
    });
  };

  const renderMachineFacts = (summary?: MachineSummary) => {
    if (!summary) {
      return <Text style={styles.emptyFacts}>Machine metadata unavailable.</Text>;
    }
    const facts: Array<{ label: string; value: string }> = [];
    if (summary.capabilities?.length) {
      facts.push({ label: 'Capabilities', value: summary.capabilities.join(', ') });
    }
    if (summary.safe_speed_ranges) {
      const speedFacts = Object.entries(summary.safe_speed_ranges)
        .map(([key, value]) => `${key}: ${value.join('–')} ${key.includes('accel') ? 'mm/s²' : 'mm/s'}`)
        .join(' | ');
      facts.push({ label: 'Speed ranges', value: speedFacts });
    }
    if (summary.max_nozzle_temp_c) {
      facts.push({ label: 'Max nozzle temp', value: `${summary.max_nozzle_temp_c} °C` });
    }
    if (summary.max_bed_temp_c) {
      facts.push({ label: 'Max bed temp', value: `${summary.max_bed_temp_c} °C` });
    }
    if (summary.spindle_rpm_range) {
      facts.push({ label: 'Spindle RPM', value: `${summary.spindle_rpm_range[0]} – ${summary.spindle_rpm_range[1]}` });
    }
    if (summary.max_feed_mm_min) {
      facts.push({ label: 'Max feed', value: `${summary.max_feed_mm_min} mm/min` });
    }
    if (!facts.length) {
      return <Text style={styles.emptyFacts}>No additional specs available yet.</Text>;
    }
    return facts.map((fact) => (
      <View key={fact.label} style={styles.factRow}>
        <Text style={styles.factLabel}>{fact.label}</Text>
        <Text style={styles.factValue}>{fact.value}</Text>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your machines</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => onOpenHistory(activeMachine ?? undefined)} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>History {historyCount > 0 ? `(${historyCount})` : ''}</Text>
          </Pressable>
          <Pressable onPress={onEditProfile} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Adjust selections</Text>
          </Pressable>
        </View>
      </View>

      {profile.machines.length === 0 && !machinesLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No machines selected yet.</Text>
          <Text style={styles.emptySubtitle}>Run onboarding to add printers or routers.</Text>
        </View>
      ) : null}

      {machinesLoading && <ActivityIndicator style={styles.loader} />}
      {machinesError && (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load machines: {machinesError}. Tap to retry.</Text>
        </Pressable>
      )}

      {!machinesLoading && profile.machines.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
            {profile.machines.map((machine) => {
              const active = machine.id === activeMachineId;
              return (
                <Pressable
                  key={machine.id}
                  onPress={() => setActiveMachineId(machine.id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {machine.brand} {machine.model}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeMachine && (
            <ScrollView style={styles.details}>
              <Text style={styles.machineHeading}>
                {activeMachine.brand} {activeMachine.model}
              </Text>
              <Text style={styles.subheading}>Experience: {profile.experience}</Text>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Material</Text>
                <View style={styles.materialRow}>
                  <TextInput
                    style={styles.materialInput}
                    placeholder="Material (PLA, PETG, ABS…)"
                    value={materialValue ?? ''}
                    onChangeText={(value) => onUpdateMaterial(activeMachine.id, value.trim() ? value : undefined)}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materialChips}>
                    {MATERIAL_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => onUpdateMaterial(activeMachine.id, option)}
                        style={[styles.materialChip, materialValue === option && styles.materialChipActive]}
                      >
                        <Text
                          style={[
                            styles.materialChipLabel,
                            materialValue === option && styles.materialChipLabelActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specs & ranges</Text>
                {renderMachineFacts(machineSummary)}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Uploads & privacy</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleTitle}>Store images locally only</Text>
                    <Text style={styles.toggleSubtitle}>
                      When enabled, history entries omit photo paths. Photos stay on this device.
                    </Text>
                  </View>
                  <Switch
                    value={settings.storeImagesLocallyOnly}
                    onValueChange={(value) => {
                      void updatePrivacy({ storeImagesLocallyOnly: value });
                    }}
                    thumbColor={settings.storeImagesLocallyOnly ? '#38bdf8' : '#1f2937'}
                    trackColor={{ true: '#38bdf855', false: '#1f2937' }}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleTitle}>Send anonymized telemetry</Text>
                    <Text style={styles.toggleSubtitle}>
                      Share aggregated usage metrics to improve recommendations.
                    </Text>
                  </View>
                  <Switch
                    value={settings.telemetryEnabled}
                    onValueChange={(value) => {
                      void updatePrivacy({ telemetryEnabled: value });
                    }}
                    thumbColor={settings.telemetryEnabled ? '#38bdf8' : '#1f2937'}
                    trackColor={{ true: '#38bdf855', false: '#1f2937' }}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Analyze this machine</Text>
                <Text style={styles.sectionSubtitle}>
                  Take a fresh photo or choose one from your library to diagnose failed prints.
                </Text>
                <CameraButton
                  floating={false}
                  disabled={loading || exporting || !activeMachine}
                  label={loading ? 'Analyzing…' : 'Take Photo'}
                  onImageReady={handleAnalyze}
                />
                {errorMessage ? <Text style={styles.analysisError}>{errorMessage}</Text> : null}
                {loading && (
                  <View style={styles.analysisProgress}>
                    <ActivityIndicator color="#38bdf8" />
                    <Text style={styles.analysisProgressText}>Analyzing photo…</Text>
                  </View>
                )}
                {previewUrl ? (
                  <View
                    style={[
                      styles.previewContainer,
                      previewSize?.height ? { aspectRatio: Math.max(previewSize.width, 1) / Math.max(previewSize.height, 1) } : null,
                    ]}
                  >
                    <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
                    {heatmapUri ? (
                      <Image source={{ uri: heatmapUri }} style={styles.heatmapOverlay} resizeMode="cover" />
                    ) : null}
                    {boundingBoxes.map((box, index) => (
                      <View
                        key={`box-${index}`}
                        style={[
                          styles.boxOverlay,
                          {
                            left: `${Math.max(0, Math.min(1, box.x)) * 100}%`,
                            top: `${Math.max(0, Math.min(1, box.y)) * 100}%`,
                            width: `${Math.max(0, Math.min(1, box.w)) * 100}%`,
                            height: `${Math.max(0, Math.min(1, box.h)) * 100}%`,
                          },
                        ]}
                      >
                        <Text style={styles.boxLabel}>
                          {box.issue_id ?? ''}
                          {typeof box.score === 'number' ? ` ${(box.score * 100).toFixed(0)}%` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {result ? (
                  <View style={styles.analysisResult}>
                    {topIssue ? (
                      <Text style={styles.resultHeading}>
                        Top issue: {topIssue}
                        {typeof topConfidence === 'number' ? ` (${formatConfidence(topConfidence)})` : ''}
                      </Text>
                    ) : null}

                    {issueList.length ? (
                      <View style={styles.issueList}>
                        {issueList.map((issue) => (
                          <View key={issue.id} style={styles.issueRow}>
                            <Text style={styles.issueName}>{issue.id}</Text>
                            <Text style={styles.issueConfidence}>{formatConfidence(issue.confidence)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {parameterEntries.length || appliedEntries.length ? (
                      <View style={styles.parameterGroup}>
                        {parameterEntries.length ? (
                          <View style={styles.parameterColumn}>
                            <Text style={styles.parameterTitle}>Parameter targets</Text>
                            {parameterEntries.map(([key, value]) => (
                              <View key={`target-${key}`} style={styles.parameterRow}>
                                <Text style={styles.parameterKey}>{key}</Text>
                                <Text style={styles.parameterValue}>{String(value)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {appliedEntries.length ? (
                          <View style={styles.parameterColumn}>
                            <Text style={styles.parameterTitle}>Applied (clamped)</Text>
                            {appliedEntries.map(([key, value]) => (
                              <View key={`applied-${key}`} style={styles.parameterRow}>
                                <Text style={styles.parameterKey}>{key}</Text>
                                <Text style={styles.parameterValue}>{String(value)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {clamped !== undefined || experienceLevel ? (
                      <Text style={styles.parameterMeta}>
                        {clamped ? 'Clamped to machine limits.' : ''}
                        {experienceLevel ? ` Experience: ${experienceLevel}.` : ''}
                      </Text>
                    ) : null}

                    {recommendations.length ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.listTitle}>Recommendations</Text>
                        {recommendations.map((item, idx) => (
                          <Text key={`rec-${idx}`} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {capabilityNotes.length ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.listTitle}>Capability notes</Text>
                        {capabilityNotes.map((item, idx) => (
                          <Text key={`cap-${idx}`} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {clampExplanations.length ? (
                      <View style={styles.listBlock}>
                        <Text style={styles.listTitle}>Clamp details</Text>
                        {clampExplanations.map((item, idx) => (
                          <Text key={`ex-${idx}`} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {hiddenParameters.length ? (
                      <Text style={styles.parameterMeta}>
                        Hidden parameters: {hiddenParameters.join(', ')}
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={handleExport}
                      disabled={!result || exporting}
                      style={[styles.exportButton, (!result || exporting) && styles.exportButtonDisabled]}
                    >
                      <Text style={styles.exportButtonLabel}>
                        {exporting ? 'Preparing export…' : 'Export slicer diff'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Search registry</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search machines"
                  value={search}
                  onChangeText={setSearch}
                />
                <ScrollView style={styles.searchResults}>
                  {filteredSummaries.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setActiveMachineId(item.id)}
                      style={[styles.searchRow, item.id === activeMachineId && styles.searchRowActive]}
                    >
                      <Text style={styles.searchLabel}>{item.brand} {item.model}</Text>
                      <Text style={styles.searchSubLabel}>{item.id}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryLabel: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#cbd5f5',
  },
  loader: {
    marginVertical: 24,
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#fecaca',
  },
  tabBar: {
    flexGrow: 0,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#38bdf8',
  },
  tabLabel: {
    color: '#cbd5f5',
  },
  tabLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  details: {
    flex: 1,
  },
  machineHeading: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subheading: {
    color: '#cbd5f5',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#111c2c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
  },
  toggleTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  materialRow: {
    gap: 12,
  },
  materialInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  materialChips: {
    flexGrow: 0,
  },
  materialChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginRight: 8,
  },
  materialChipActive: {
    backgroundColor: '#38bdf8',
  },
  materialChipLabel: {
    color: '#e2e8f0',
  },
  materialChipLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  factLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  factValue: {
    color: '#e2e8f0',
    flex: 1,
    textAlign: 'right',
  },
  emptyFacts: {
    color: '#94a3b8',
  },
  analysisError: {
    color: '#fca5a5',
    fontSize: 13,
  },
  analysisProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisProgressText: {
    color: '#e2e8f0',
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  heatmapOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  boxOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    justifyContent: 'flex-start',
  },
  boxLabel: {
    backgroundColor: 'rgba(56, 189, 248, 0.9)',
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 11,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  analysisResult: {
    gap: 12,
  },
  resultHeading: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  issueList: {
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden',
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  issueName: {
    color: '#e2e8f0',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  issueConfidence: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  parameterGroup: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  parameterColumn: {
    flex: 1,
    minWidth: 140,
    gap: 6,
  },
  parameterTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  parameterKey: {
    color: '#94a3b8',
  },
  parameterValue: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  parameterMeta: {
    color: '#cbd5f5',
    fontSize: 12,
  },
  listBlock: {
    gap: 4,
  },
  listTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  listItem: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  exportButton: {
    marginTop: 8,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchResults: {
    maxHeight: 180,
  },
  searchRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2937',
  },
  searchRowActive: {
    backgroundColor: '#1c2c40',
  },
  searchLabel: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  searchSubLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
});
