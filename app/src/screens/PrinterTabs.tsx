import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  View,
  Platform,
} from 'react-native';

import { CameraButton, type PreparedImage } from '../components/CameraButton';
import WebPhotoPicker from '../components/WebPhotoPicker';
import { useAnalyze } from '../hooks/useAnalyze';
import { filterMachines, useMachineRegistry } from '../hooks/useMachineRegistry';
import type {
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

// Minimal type for the upload-queue callback item
type QueueItem = { machine: MachineRef; material?: string; fileUri?: string };

export const PrinterTabs: React.FC<PrinterTabsProps> = ({
  profile,
  onEditProfile,
  onShowAnalysis,
  onUpdateMaterial,
  onOpenHistory,
  onRecordHistory,
  historyCounts,
}) => {
  // no `lookup`—we’ll resolve summaries from `machines`
  const { machines, loading, error, refresh } = useMachineRegistry();
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

  // Get a machine summary by id using current machines array
  const getSummary = useCallback(
    (id?: string | null) => (id ? machines.find((m) => m.id === id) : undefined),
    [machines],
  );

  // 🔹 write a history entry + open results (includes `predictions`)
  const showAndRecord = useCallback(
    async (args: {
      machine: MachineRef;
      material?: string;
      summary?: MachineSummary;
      image?: { uri: string; width: number; height: number };
      response: AnalyzeResponse;
      localUri?: string;
    }) => {
      const entry: AnalysisHistoryRecord = {
        imageId: args.response.image_id,
        machineId: args.machine.id,
        machine: args.machine,
        timestamp: Date.now(),
        predictions: args.response.issue_list, // align with AnalysisHistoryRecord
        response: args.response,
        material: args.material,
        localUri: settings.storeImagesLocallyOnly ? undefined : args.localUri,
        summary: args.summary,
      };
      await onRecordHistory(entry);
      onShowAnalysis({
        machine: args.machine,
        response: args.response,
        material: args.material,
        summary: args.summary,
        image: args.image,
      });
    },
    [onRecordHistory, onShowAnalysis, settings.storeImagesLocallyOnly],
  );

  const handleQueueSuccess = useCallback(
    (item: QueueItem, response: AnalyzeResponse) => {
      const summary = getSummary(item.machine.id);
      const entry: AnalysisHistoryRecord = {
        imageId: response.image_id,
        machineId: item.machine.id,
        machine: item.machine,
        timestamp: Date.now(),
        predictions: response.issue_list,
        response,
        material: item.material,
        localUri: settings.storeImagesLocallyOnly ? undefined : item.fileUri,
        summary,
      };
      void onRecordHistory(entry);
    },
    [getSummary, onRecordHistory, settings.storeImagesLocallyOnly],
  );

  const analyzeMutation = useAnalyze({ onQueueSuccess: handleQueueSuccess });
  const { mutate, isPending, isSuccess, data, reset, progress, queuedCount, retryQueued } = analyzeMutation;

  useEffect(() => {
    const currentIds = profile.machines.map((item) => item.id);
    if (!activeMachineId || !currentIds.includes(activeMachineId)) {
      setActiveMachineId(currentIds[0] ?? null);
    }
  }, [activeMachineId, profile.machines]);

  const activeMachine = useMemo(
    () => profile.machines.find((machine) => machine.id === activeMachineId) ?? null,
    [activeMachineId, profile.machines],
  );

  const machineSummary = getSummary(activeMachineId || undefined);

  const materialValue = activeMachineId
    ? profile.materialByMachine?.[activeMachineId] ?? profile.material
    : profile.material;

  const historyCount = activeMachineId ? historyCounts[activeMachineId] ?? 0 : 0;

  const filteredSummaries = useMemo(() => filterMachines(machines, search), [machines, search]);

  // Native/RN (CameraButton) → queue/mutate path
  const handleAnalyze = async (image: PreparedImage) => {
    if (!activeMachine) return;
    const meta: AnalyzeRequestMeta = {
      machine_id: activeMachine.id,
      experience: profile.experience,
      material: materialValue,
      app_version: 'app-ai-alpha',
    };
    const summary = getSummary(activeMachine.id);
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

  // Handle queued result from RN path
  useEffect(() => {
    if (isSuccess && data && lastRequest) {
      void showAndRecord({
        machine: lastRequest.machine,
        material: lastRequest.material,
        summary: lastRequest.summary ?? machineSummary,
        image: lastRequest.image,
      response: data,
        localUri: lastRequest.imageUri,
      });
      reset();
      setLastRequest(null);
    }
  }, [data, isSuccess, lastRequest, machineSummary, reset, showAndRecord]);

  useEffect(() => {
    void retryQueued();
  }, [retryQueued]);
  useEffect(() => {
    if (isSuccess) void retryQueued();
  }, [isSuccess, retryQueued]);

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

      {profile.machines.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No machines selected yet.</Text>
          <Text style={styles.emptySubtitle}>Run onboarding to add printers or routers.</Text>
        </View>
      ) : null}

      {loading && <ActivityIndicator style={styles.loader} />}
      {error && (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load machines: {error}. Tap to retry.</Text>
        </Pressable>
      )}

      {!loading && profile.machines.length > 0 && (
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

              {/* 🔹 WEB-ONLY: Choose/Take Photo button that posts to /api/analyze */}
              {Platform.OS === 'web' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Analyze a failed print (photo)</Text>
                  <WebPhotoPicker
                    machineId={activeMachine.id}
                    material={materialValue || 'PLA'}
                    experience={profile.experience as any}
                    label="Choose photo"
                    onResult={(res) => {
                      void showAndRecord({
                        machine: activeMachine,
                        material: materialValue,
                        summary: machineSummary,
                        image: undefined,
                        response: res,
                      });
                    }}
                    onError={(m) => {
                      alert(`Analyze error: ${m}`);
                    }}
                  />
                </View>
              )}

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
                    thumbColor={settings.storeImagesLocallyOnly ? '#38bdf8' : '#1f2937'}  // fixed typo usage
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
                {queuedCount > 0 && (
                  <Pressable style={styles.queueBanner} onPress={() => retryQueued()}>
                    <Text style={styles.queueText}>
                      {queuedCount} upload{queuedCount > 1 ? 's' : ''} queued. Tap to retry now.
                    </Text>
                  </Pressable>
                )}
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
                      <Text style={styles.searchLabel}>
                        {item.brand} {item.model}
                      </Text>
                      <Text style={styles.searchSubLabel}>{item.id}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </>
      )}

      {isPending && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.uploadText}>Uploading… {Math.round((progress || 0) * 100)}%</Text>
        </View>
      )}

      {/* 🔹 Native camera button (kept for iOS/Android/Expo Go) */}
      {Platform.OS !== 'web' && (
        <CameraButton disabled={isPending || !activeMachine} onImageReady={handleAnalyze} />
      )}
    </View>
  );
};

// ------- helpers & styles -------

function renderMachineFacts(summary?: MachineSummary) {
  if (!summary) {
    return <Text style={styles.emptyFacts}>Machine metadata unavailable.</Text>;
  }
  const facts: Array<{ label: string; value: string }> = [];
  if (summary.capabilities?.length) {
    facts.push({ label: 'Capabilities', value: summary.capabilities.join(', ') });
  }
  if (summary.safe_speed_ranges) {
    const speedFacts = Object.entries(summary.safe_speed_ranges)
      .map(
        ([key, value]) =>
          `${key}: ${(value as number[]).join('–')} ${key.includes('accel') ? 'mm/s²' : 'mm/s'}`,
      )
      .join(' | ');
    facts.push({ label: 'Speed ranges', value: speedFacts });
  }
  if (summary.max_nozzle_temp_c) facts.push({ label: 'Max nozzle temp', value: `${summary.max_nozzle_temp_c} °C` });
  if (summary.max_bed_temp_c) facts.push({ label: 'Max bed temp', value: `${summary.max_bed_temp_c} °C` });
  if (summary.spindle_rpm_range) {
    facts.push({ label: 'Spindle RPM', value: `${summary.spindle_rpm_range[0]} – ${summary.spindle_rpm_range[1]}` });
  }
  if (summary.max_feed_mm_min) facts.push({ label: 'Max feed', value: `${summary.max_feed_mm_min} mm/min` });
  if (!facts.length) {
    return <Text style={styles.emptyFacts}>No additional specs available yet.</Text>;
  }
  return facts.map((fact) => (
    <View key={fact.label} style={styles.factRow}>
      <Text style={styles.factLabel}>{fact.label}</Text>
      <Text style={styles.factValue}>{fact.value}</Text>
    </View>
  ));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryLabel: { color: '#e2e8f0', fontWeight: '500' },
  emptyState: { backgroundColor: '#1f2937', borderRadius: 12, padding: 24, gap: 8 },
  emptyTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: '#cbd5f5' },
  loader: { marginVertical: 24 },
  errorBox: { backgroundColor: '#7f1d1d', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { color: '#fecaca' },
  tabBar: { flexGrow: 0, marginBottom: 12 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#1f2937', marginRight: 8 },
  tabActive: { backgroundColor: '#38bdf8' },
  tabLabel: { color: '#cbd5f5' },
  tabLabelActive: { color: '#0f172a', fontWeight: '600' },
  details: { flex: 1 },
  machineHeading: { color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subheading: { color: '#cbd5f5', marginBottom: 16 },
  section: { backgroundColor: '#111c2c', borderRadius: 12, padding: 16, marginBottom: 16, gap: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  toggleCopy: { flex: 1, gap: 6 },
  toggleTitle: { color: '#f8fafc', fontWeight: '600' },
  toggleSubtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  materialRow: { gap: 12 },
  materialInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  materialChips: { flexGrow: 0 },
  materialChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1f2937', marginRight: 8 },
  materialChipActive: { backgroundColor: '#38bdf8' },
  materialChipLabel: { color: '#e2e8f0' },
  materialChipLabelActive: { color: '#0f172a', fontWeight: '600' },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factLabel: { color: '#94a3b8', fontWeight: '600' },
  factValue: { color: '#e2e8f0', flex: 1, textAlign: 'right' },
  emptyFacts: { color: '#94a3b8' },
  searchInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchResults: { maxHeight: 180 },
  searchRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1f2937' },
  searchRowActive: { backgroundColor: '#1c2c40' },
  searchLabel: { color: '#e2e8f0', fontWeight: '500' },
  searchSubLabel: { color: '#94a3b8', fontSize: 12 },
  uploadBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    backgroundColor: '#38bdf8',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: { color: '#0f172a', fontWeight: '600' },
  queueBanner: { marginTop: 8, backgroundColor: '#1e3a8a', borderRadius: 10, padding: 12 },
  queueText: { color: '#bfdbfe', fontWeight: '500' },
});
