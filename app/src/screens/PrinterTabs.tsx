import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { exportProfile } from '../api/client';
import { WebPhotoPicker } from '../components/WebPhotoPicker';
import { CameraButton, type PreparedImage } from '../components/CameraButton';
import { useAnalyze } from '../hooks/useAnalyze';
import { filterMachines, useMachineRegistry } from '../hooks/useMachineRegistry';
import { usePrivacySettings } from '../state/privacy';
import type {
  AnalyzeRequestMeta,
  AnalyzeResponse,
  AnalysisHistoryRecord,
  MachineRef,
  MachineSummary,
  ProfileState,
} from '../types';

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

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function percent(value: number): string {
  return `${(clamp01(value) * 100).toFixed(1)}%`;
}

function formatConfidence(value?: number): string {
  if (typeof value !== 'number') {
    return '—';
  }
  return percent(value);
}

function entries(record?: Record<string, string | number | boolean>): Array<[string, string | number | boolean]> {
  return Object.entries(record ?? {});
}

export const PrinterTabs: React.FC<PrinterTabsProps> = ({
  profile,
  onEditProfile,
  onShowAnalysis,
  onUpdateMaterial,
  onOpenHistory,
  onRecordHistory,
  historyCounts,
}) => {
  const { machines, loading: machinesLoading, error: machinesError, refresh } = useMachineRegistry();
  const { settings, update: updatePrivacy } = usePrivacySettings();

  const [activeMachineId, setActiveMachineId] = useState<string | null>(profile.machines[0]?.id ?? null);
  const [search, setSearch] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [webBusy, setWebBusy] = useState(false);

  const pendingImageRef = useRef<{ uri: string; width: number; height: number } | null>(null);
  const lastResponseIdRef = useRef<string | null>(null);

  const {
    mutate,
    isPending,
    isSuccess,
    data: analyzeData,
    reset,
    progress,
    queuedCount,
    retryQueued,
  } = useAnalyze({
    onQueueSuccess: useCallback(
      (item, response) => {
        const summary = machines.find((machine) => machine.id === item.machine.id);
        const entry: AnalysisHistoryRecord = {
          imageId: response.image_id ?? `queued-${Date.now()}`,
          machineId: item.machine.id,
          machine: item.machine,
          timestamp: Date.now(),
          response,
          material: item.material,
          localUri: settings.storeImagesLocallyOnly ? undefined : item.fileUri,
          summary,
          predictions: response.predictions,
        };
        void onRecordHistory(entry);
      },
      [machines, onRecordHistory, settings.storeImagesLocallyOnly],
    ),
  });

  const machinesLookup = useMemo(() => new Map(machines.map((item) => [item.id, item])), [machines]);

  const filteredMachines = useMemo(() => filterMachines(machines, search), [machines, search]);

  useEffect(() => {
    const ids = profile.machines.map((item) => item.id);
    if (!activeMachineId || !ids.includes(activeMachineId)) {
      setActiveMachineId(ids[0] ?? null);
    }
  }, [activeMachineId, profile.machines]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const activeMachine: MachineRef | null = useMemo(() => {
    if (!activeMachineId) {
      return null;
    }
    return profile.machines.find((machine) => machine.id === activeMachineId) ?? null;
  }, [activeMachineId, profile.machines]);

  const machineSummary = activeMachineId ? machinesLookup.get(activeMachineId) : undefined;
  const materialValue = activeMachineId
    ? profile.materialByMachine?.[activeMachineId] ?? profile.material
    : profile.material;
  const historyCount = activeMachineId ? historyCounts[activeMachineId] ?? 0 : 0;

  const handleAnalysisComplete = useCallback(
    (
      machine: MachineRef,
      response: AnalyzeResponse,
      options?: { image?: { uri: string; width: number; height: number }; material?: string; summary?: MachineSummary },
    ) => {
      if (response.image_id && lastResponseIdRef.current === response.image_id) {
        return;
      }
      lastResponseIdRef.current = response.image_id ?? null;
      setResult(response);
      setErrorMessage(null);

      if (options?.image) {
        const { uri, width, height } = options.image;
        if (previewUrl && previewUrl.startsWith('blob:') && typeof URL !== 'undefined') {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(uri);
        setPreviewSize({ width, height });
      }

      const entry: AnalysisHistoryRecord = {
        imageId: response.image_id ?? `local-${Date.now()}`,
        machineId: machine.id,
        machine,
        timestamp: Date.now(),
        response,
        material: options?.material,
        localUri: settings.storeImagesLocallyOnly ? undefined : options?.image?.uri,
        summary: options?.summary,
        predictions: response.predictions,
      };
      void onRecordHistory(entry);
      onShowAnalysis({ machine, response, material: options?.material, summary: options?.summary, image: options?.image });
    },
    [onRecordHistory, onShowAnalysis, previewUrl, settings.storeImagesLocallyOnly],
  );

  useEffect(() => {
    if (!isSuccess || !analyzeData || !activeMachine) {
      return;
    }
    const preview = pendingImageRef.current ?? undefined;
    const summary = activeMachineId ? machinesLookup.get(activeMachineId) : undefined;
    handleAnalysisComplete(activeMachine, analyzeData, {
      image: preview,
      material: materialValue ?? undefined,
      summary,
    });
    pendingImageRef.current = preview ?? null;
    reset();
  }, [activeMachine, activeMachineId, analyzeData, handleAnalysisComplete, isSuccess, machinesLookup, materialValue, reset]);

  const handleNativeImage = useCallback(
    (image: PreparedImage) => {
      if (!activeMachine) {
        return;
      }
      setErrorMessage(null);
      setResult(null);
      pendingImageRef.current = { uri: image.uri, width: image.width, height: image.height };
      setPreviewUrl(image.uri);
      setPreviewSize({ width: image.width, height: image.height });

      const meta: AnalyzeRequestMeta = {
        machine_id: activeMachine.id,
        experience: profile.experience,
        material: materialValue ?? 'PLA',
        app_version: DEFAULT_APP_VERSION,
      };

      mutate({
        file: { uri: image.uri, name: image.name, type: image.type },
        meta,
        machine: activeMachine,
        material: materialValue,
      });
    },
    [activeMachine, materialValue, mutate, profile.experience],
  );

  const handleWebResult = useCallback(
    (response: AnalyzeResponse) => {
      if (!activeMachine) {
        return;
      }
      const summary = activeMachineId ? machinesLookup.get(activeMachineId) : undefined;
      const image = pendingImageRef.current ?? undefined;
      handleAnalysisComplete(activeMachine, response, {
        image,
        material: materialValue ?? undefined,
        summary,
      });
    },
    [activeMachine, activeMachineId, handleAnalysisComplete, machinesLookup, materialValue],
  );

  const handleWebError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const handlePreviewReady = useCallback((preview: { uri: string; width: number; height: number }) => {
    if (previewUrl && previewUrl.startsWith('blob:') && typeof URL !== 'undefined') {
      URL.revokeObjectURL(previewUrl);
    }
    setResult(null);
    setErrorMessage(null);
    pendingImageRef.current = preview;
    setPreviewUrl(preview.uri);
    setPreviewSize({ width: preview.width, height: preview.height });
  }, [previewUrl]);

  const heatmapUri = result?.localization?.heatmap?.data_url ?? null;
  const boxes = result?.localization?.boxes ?? [];
  const predictions = result?.predictions ?? [];
  const recommendations = result?.recommendations ?? [];
  const capabilityNotes = result?.capability_notes ?? [];
  const explanations = result?.explanations ?? [];
  const appliedEntries = entries(result?.applied as Record<string, string | number | boolean> | undefined);
  const diffEntries = entries(result?.slicer_profile_diff?.diff);
  const topPrediction = predictions[0];

  const busy = isPending || webBusy;

  const handleExport = useCallback(async () => {
    if (!result) {
      return;
    }
    try {
      setExporting(true);
      const changes = Object.keys(result.applied ?? {}).length
        ? (result.applied as Record<string, string | number | boolean>)
        : result.slicer_profile_diff?.diff ?? {};
      const diff = await exportProfile({ slicer: 'cura', changes });
      const markdown = result.slicer_profile_diff?.markdown ?? null;
      if (Platform.OS === 'web') {
        const payload = markdown ?? JSON.stringify({ diff: diff.diff }, null, 2);
        const blob = new Blob([payload], { type: markdown ? 'text/markdown' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `slicer-diff-${
          result.meta?.machine?.id ?? result.image_id ?? 'printer'
        }.${
          markdown ? 'md' : 'json'
        }`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const message = markdown ?? JSON.stringify(diff.diff, null, 2);
        await Share.share({ message, title: 'Slicer diff' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    } finally {
      setExporting(false);
    }
  }, [result]);

  const renderMachineFacts = useCallback((summary?: MachineSummary) => {
    if (!summary) {
      return <Text style={styles.emptyFacts}>Machine metadata unavailable.</Text>;
    }
    const rows: Array<{ label: string; value: string }> = [];
    if (summary.capabilities?.length) {
      rows.push({ label: 'Capabilities', value: summary.capabilities.join(', ') });
    }
    if (summary.safe_speed_ranges) {
      const text = Object.entries(summary.safe_speed_ranges)
        .map(([key, range]) => `${key}: ${range.join('–')}`)
        .join(' | ');
      rows.push({ label: 'Safe speeds', value: text });
    }
    if (summary.max_nozzle_temp_c) {
      rows.push({ label: 'Max nozzle temp', value: `${summary.max_nozzle_temp_c} °C` });
    }
    if (summary.max_bed_temp_c) {
      rows.push({ label: 'Max bed temp', value: `${summary.max_bed_temp_c} °C` });
    }
    if (summary.spindle_rpm_range) {
      rows.push({ label: 'Spindle RPM', value: `${summary.spindle_rpm_range[0]} – ${summary.spindle_rpm_range[1]}` });
    }
    if (summary.max_feed_mm_min) {
      rows.push({ label: 'Max feed', value: `${summary.max_feed_mm_min} mm/min` });
    }
    if (rows.length === 0) {
      return <Text style={styles.emptyFacts}>No additional specs available yet.</Text>;
    }
    return rows.map((row) => (
      <View key={row.label} style={styles.factRow}>
        <Text style={styles.factLabel}>{row.label}</Text>
        <Text style={styles.factValue}>{row.value}</Text>
      </View>
    ));
  }, []);

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

      {machinesLoading && <ActivityIndicator style={styles.loader} />}
      {machinesError ? (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load machines: {machinesError}. Tap to retry.</Text>
        </Pressable>
      ) : null}

      {profile.machines.length === 0 && !machinesLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No machines selected yet.</Text>
          <Text style={styles.emptySubtitle}>Run onboarding to add printers.</Text>
        </View>
      ) : null}

      {profile.machines.length > 0 ? (
        <>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Search machines"
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
            {filteredMachines.map((machine) => {
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

          {activeMachine ? (
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
                    placeholderTextColor="#64748b"
                    value={materialValue ?? ''}
                    onChangeText={(value) =>
                      onUpdateMaterial(activeMachine.id, value.trim() ? value.trim() : undefined)
                    }
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materialChips}>
                    {MATERIAL_OPTIONS.map((option) => {
                      const selected = materialValue === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => onUpdateMaterial(activeMachine.id, option)}
                          style={[styles.materialChip, selected && styles.materialChipActive]}
                        >
                          <Text style={[styles.materialChipLabel, selected && styles.materialChipLabelActive]}>
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
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
                      When enabled, history entries omit local file paths.
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
                    <Text style={styles.toggleSubtitle}>Share aggregated usage metrics to improve suggestions.</Text>
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

                {Platform.OS === 'web' ? (
                  <WebPhotoPicker
                    machineId={activeMachine.id}
                    material={materialValue ?? undefined}
                    experience={profile.experience}
                    label={webBusy ? 'Uploading…' : 'Choose Photo'}
                    onResult={handleWebResult}
                    onError={handleWebError}
                    onPreviewReady={handlePreviewReady}
                    onBusyChange={setWebBusy}
                    appVersion={DEFAULT_APP_VERSION}
                  />
                ) : (
                  <CameraButton
                    disabled={busy || exporting}
                    label={busy ? 'Analyzing…' : 'Take Photo'}
                    onImageReady={handleNativeImage}
                  />
                )}

                {queuedCount > 0 ? (
                  <Pressable onPress={retryQueued} style={styles.queueButton}>
                    <Text style={styles.queueText}>Retry {queuedCount} queued upload{queuedCount === 1 ? '' : 's'}</Text>
                  </Pressable>
                ) : null}

                {busy ? (
                  <View style={styles.analysisProgress}>
                    <ActivityIndicator color="#38bdf8" />
                    <Text style={styles.analysisProgressText}>
                      Analyzing photo… {progress ? `${Math.round(progress * 100)}%` : ''}
                    </Text>
                  </View>
                ) : null}

                {errorMessage ? <Text style={styles.analysisError}>{errorMessage}</Text> : null}

                {previewUrl ? (
                  <View
                    style={[
                      styles.previewContainer,
                      previewSize?.height
                        ? { aspectRatio: Math.max(previewSize.width, 1) / Math.max(previewSize.height, 1) }
                        : undefined,
                    ]}
                  >
                    <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
                    {heatmapUri ? (
                      <Image
                        source={{ uri: heatmapUri }}
                        style={styles.heatmapOverlay}
                        resizeMode="cover"
                      />
                    ) : null}
                    {boxes.map((box, index) => (
                      <View
                        key={`${box.issue_id}-${index}`}
                        style={[
                          styles.boxOverlay,
                          {
                            left: `${clamp01(box.x) * 100}%` as any,
                            top: `${clamp01(box.y) * 100}%` as any,
                            width: `${clamp01(box.width) * 100}%` as any,
                            height: `${clamp01(box.height) * 100}%` as any,
                          },
                        ]}
                      >
                        <Text style={styles.boxLabel}>
                          {box.issue_id} {formatConfidence(box.confidence)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {result ? (
                  <View style={styles.analysisResult}>
                    {topPrediction ? (
                      <Text style={styles.resultHeading}>
                        Top issue: {topPrediction.issue_id} ({formatConfidence(topPrediction.confidence)})
                      </Text>
                    ) : (
                      <Text style={styles.resultHeading}>No dominant issue detected.</Text>
                    )}

                    {predictions.length ? (
                      <View style={styles.issueList}>
                        {predictions.map((prediction) => (
                          <View key={prediction.issue_id} style={styles.issueRow}>
                            <Text style={styles.issueName}>{prediction.issue_id}</Text>
                            <Text style={styles.issueConfidence}>{formatConfidence(prediction.confidence)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {appliedEntries.length || diffEntries.length ? (
                      <View style={styles.parameterGroup}>
                        {appliedEntries.length ? (
                          <View style={styles.parameterColumn}>
                            <Text style={styles.parameterTitle}>Applied parameters</Text>
                            {appliedEntries.map(([key, value]) => (
                              <View key={`applied-${key}`} style={styles.parameterRow}>
                                <Text style={styles.parameterKey}>{key}</Text>
                                <Text style={styles.parameterValue}>{String(value)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {diffEntries.length ? (
                          <View style={styles.parameterColumn}>
                            <Text style={styles.parameterTitle}>Profile diff</Text>
                            {diffEntries.map(([key, value]) => (
                              <View key={`diff-${key}`} style={styles.parameterRow}>
                                <Text style={styles.parameterKey}>{key}</Text>
                                <Text style={styles.parameterValue}>{String(value)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {recommendations.length ? (
                      <View style={styles.recommendations}>
                        <Text style={styles.parameterTitle}>Recommendations</Text>
                        {recommendations.map((item) => (
                          <Text key={item} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {capabilityNotes.length ? (
                      <View style={styles.recommendations}>
                        <Text style={styles.parameterTitle}>Capability notes</Text>
                        {capabilityNotes.map((item) => (
                          <Text key={item} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {explanations.length ? (
                      <View style={styles.recommendations}>
                        <Text style={styles.parameterTitle}>Explanations</Text>
                        {explanations.map((item, index) => (
                          <Text key={`${item}-${index}`} style={styles.listItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    <Pressable onPress={handleExport} disabled={exporting} style={styles.exportButton}>
                      <Text style={styles.exportLabel}>{exporting ? 'Preparing export…' : 'Export slicer diff'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryLabel: {
    color: '#e0f2fe',
    fontWeight: '600',
  },
  loader: {
    marginTop: 12,
  },
  errorBox: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#7f1d1d',
    padding: 12,
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
  },
  emptyState: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#111c2c',
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#94a3b8',
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabBar: {
    flexGrow: 0,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
  },
  factLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  factValue: {
    color: '#e2e8f0',
    flexShrink: 1,
    textAlign: 'right',
  },
  emptyFacts: {
    color: '#94a3b8',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  analysisProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisProgressText: {
    color: '#cbd5f5',
  },
  analysisError: {
    color: '#fca5a5',
    fontSize: 13,
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  heatmapOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  boxOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'solid',
    justifyContent: 'flex-start',
  },
  boxLabel: {
    backgroundColor: 'rgba(249, 115, 22, 0.85)',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  analysisResult: {
    gap: 16,
  },
  resultHeading: {
    color: '#facc15',
    fontWeight: '600',
    fontSize: 16,
  },
  issueList: {
    gap: 8,
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  issueName: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  issueConfidence: {
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  parameterGroup: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  parameterColumn: {
    flex: 1,
    gap: 8,
  },
  parameterTitle: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 15,
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  parameterKey: {
    color: '#cbd5f5',
    flex: 1,
  },
  parameterValue: {
    color: '#e2e8f0',
    textAlign: 'right',
    flexShrink: 0,
    marginLeft: 8,
  },
  recommendations: {
    gap: 6,
  },
  listItem: {
    color: '#cbd5f5',
  },
  exportButton: {
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
  queueButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  queueText: {
    color: '#38bdf8',
  },
});

export default PrinterTabs;
