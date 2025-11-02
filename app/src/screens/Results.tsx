<<<<<<< HEAD
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useMachineRegistry } from '../hooks/useMachineRegistry';
import { analyzeMachineJSON, exportProfile } from '../api/client';
import type {
  AnalyzeResponse,
  ExperienceLevel,
  MachineRef,
  MachineSummary,
  SlicerId,
} from '../types';
=======
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { analyzeMachine, exportProfile } from '../api/client';
import { useMachineRegistry } from '../hooks/useMachineRegistry';
import { filterParametersForExperience, deriveParameterRanges } from '../state/onboarding';
import type { AnalyzeResponse, ExperienceLevel, MachineRef, MachineSummary } from '../types';
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1

interface ResultsScreenProps {
  selectedMachines: string[];        // machine ids chosen earlier
  experience: ExperienceLevel;
  material?: string;
  onBack(): void;
}

const SLICERS: Array<{ id: SlicerId; label: string }> = [
  { id: 'cura', label: 'Export for Cura' },
  { id: 'prusaslicer', label: 'Export for PrusaSlicer' },
  { id: 'bambu', label: 'Export for Bambu Studio' },
  { id: 'orca', label: 'Export for OrcaSlicer' },
];

<<<<<<< HEAD
export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  selectedMachines,
  experience,
  material,
  onBack,
}) => {
  const { machines, loading, error, refresh } = useMachineRegistry();
  const initialActive = selectedMachines[0] ?? machines[0]?.id ?? null;

  const [activeMachineId, setActiveMachineId] = useState<string | null>(initialActive);
  const [busy, setBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);

  const activeMachine: MachineSummary | undefined = useMemo(
    () => (activeMachineId ? machines.find((m) => m.id === activeMachineId) : undefined),
    [activeMachineId, machines]
=======
function coerceNumericParameters(values: Record<string, string | number | boolean | undefined>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

function buildMachineRef(id: string, summaries: MachineSummary[]): MachineRef {
  const summary = summaries.find((item) => item.id === id);
  if (summary) {
    return { id: summary.id, brand: summary.brand, model: summary.model };
  }
  return { id, brand: id, model: id };
}

export const ResultsScreen: React.FC<ResultsProps> = ({ selectedMachines, experience, onReset }) => {
  const { machines, loading: machinesLoading, error: machinesError, refresh } = useMachineRegistry();
  const [activeMachineId, setActiveMachineId] = useState<string | null>(selectedMachines[0] ?? null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedSummaries = useMemo(
    () => machines.filter((machine) => selectedMachines.includes(machine.id)),
    [machines, selectedMachines],
  );

  useEffect(() => {
    if (!activeMachineId) {
      setAnalysis(null);
      return;
    }
    const machineRef = buildMachineRef(activeMachineId, selectedSummaries.length ? selectedSummaries : machines);
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyzeMachine({
          machine: machineRef,
          experience,
          material: 'PLA',
          issues: [],
        });
        setAnalysis(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeMachineId, experience, machines, selectedSummaries]);

  useEffect(() => {
    setActiveMachineId(selectedMachines[0] ?? null);
  }, [selectedMachines]);

  const filteredParameters = useMemo(() => {
    if (!analysis) {
      return {} as Record<string, number>;
    }
    return filterParametersForExperience(analysis.applied, experience);
  }, [analysis, experience]);

  const parameterRanges = useMemo(
    () => deriveParameterRanges(filteredParameters, experience),
    [filteredParameters, experience],
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
  );

  const visibleMachines: MachineSummary[] = useMemo(
    () => machines.filter((m) => selectedMachines.includes(m.id)),
    [machines, selectedMachines]
  );

  const handleAnalyze = async () => {
    if (!activeMachine) return;
    try {
      setBusy(true);
      setResponse(null);
      // Quick JSON-only analysis (no photo) using the current selections
      const res = await analyzeMachineJSON({
        machine: { id: activeMachine.id, brand: activeMachine.brand, model: activeMachine.model },
        experience,
        material,
        issues: [], // leave empty; backend can still return predictions/recs based on metadata
      });
      setResponse(res);
    } catch (e: any) {
      Alert.alert('Analyze error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
<<<<<<< HEAD
=======
  const diff = await exportProfile({
    slicer,
    changes: analysis.slicer_profile_diff?.diff ?? analysis.applied ?? {},
  });
    const payload = analysis.slicer_profile_diff?.markdown ?? JSON.stringify(diff, null, 2);
    await Clipboard.setStringAsync(payload);
    setCopied(slicer);
    setTimeout(() => setCopied(null), 2500);
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    if (Platform.OS !== 'web') return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDiff = () => {
    if (!response?.slicer_profile_diff) return;
    const baseName = `${activeMachine?.id ?? 'machine'}-slicer-diff`;
    const jsonPayload = JSON.stringify(response.slicer_profile_diff, null, 2);

    if (Platform.OS === 'web') {
      downloadBlob(jsonPayload, `${baseName}.json`, 'application/json');
      if (response.slicer_profile_diff.markdown) {
        downloadBlob(response.slicer_profile_diff.markdown, `${baseName}.md`, 'text/markdown');
        setExportMessage('Downloaded JSON + Markdown diff');
      } else {
        setExportMessage('Downloaded JSON diff');
      }
      return;
    }
    const text = response.slicer_profile_diff.markdown ?? jsonPayload;
    Clipboard.setStringAsync(text).then(() => {
      setExportMessage(response.slicer_profile_diff?.markdown ? 'Markdown copied to clipboard' : 'JSON copied to clipboard');
    });
  };

  const handleCopyForSlicer = async (slicer: SlicerId) => {
    if (!response?.slicer_profile_diff) {
      Alert.alert('Nothing to export', 'Run an analysis first.');
      return;
    }
    try {
      const result = await exportProfile({
        slicer,
        // keep changes minimal — backend will translate to precise slicer keys
        changes: response.slicer_profile_diff.diff ?? {}, // already Record<string, number|string|boolean>
      });
      await Clipboard.setStringAsync(JSON.stringify(result.diff, null, 2));
      setExportMessage(`Copied diff for ${slicer}`);
    } catch (e: any) {
      Alert.alert('Export error', String(e?.message ?? e));
    }
  };

  const predictions = analysis?.predictions ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
<<<<<<< HEAD
        <Pressable onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Back</Text>
=======
        <View style={styles.badgeRow}>
          {selectedMachines.map((id) => {
            const active = id === activeMachineId;
            return (
              <Pressable
                key={id}
                onPress={() => setActiveMachineId(id)}
                style={[styles.badge, active && styles.badgeActive]}
              >
                <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>{id}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onReset} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Adjust selections</Text>
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
        </Pressable>
        <Text style={styles.title}>Results</Text>
        <View style={{ width: 96 }} />
      </View>

<<<<<<< HEAD
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : error ? (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load machines: {error}. Tap to retry.</Text>
        </Pressable>
      ) : null}

      {/* Tabs for selected machines */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {visibleMachines.map((m) => {
          const active = m.id === activeMachineId;
          return (
            <Pressable
              key={m.id}
              onPress={() => setActiveMachineId(m.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {m.brand} {m.model}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 48 }}>
        {activeMachine ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {activeMachine.brand} {activeMachine.model}
            </Text>
            <Text style={styles.subtle}>
              Experience: {experience}
              {material ? ` • Material: ${material}` : ''}
            </Text>

            <Pressable onPress={handleAnalyze} style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}>
              {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryLabel}>Analyze (no photo)</Text>}
            </Pressable>

            {response ? (
              <View style={{ marginTop: 16, gap: 16 }}>
                {/* Predictions */}
                <View>
                  <Text style={styles.sectionSubtitle}>Predicted issues</Text>
                  {response.predictions?.length ? (
                    response.predictions.map((p) => (
                      <View key={p.issue_id} style={styles.row}>
                        <Text style={styles.rowLabel}>{p.issue_id}</Text>
                        <Text style={styles.rowValue}>{Math.round((p.confidence ?? 0) * 100)}%</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No predictions returned.</Text>
                  )}
                </View>
=======
      {machinesLoading && <ActivityIndicator style={styles.loader} />}
      {machinesError ? (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load machine data: {machinesError}. Tap to retry.</Text>
        </Pressable>
      ) : null}
      {error && <Text style={styles.error}>{error}</Text>}

      {analysis && !loading ? (
        <ScrollView style={styles.scroll}>
          <Text style={styles.title}>Recommended parameters</Text>
          <Text style={styles.subtitle}>Experience mode: {experience}</Text>
          <View style={styles.parameterList}>
            {Object.entries(filteredParameters).map(([key, value]) => {
              const range = parameterRanges[key];
              return (
                <View key={key} style={styles.parameterRow}>
                  <Text style={styles.parameterName}>{key}</Text>
                  <Text style={styles.parameterValue}>{value.toFixed(2)}</Text>
                  {range && (
                    <Text style={styles.parameterRange}>
                      Range: {range.min.toFixed(2)} – {range.max.toFixed(2)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.title}>Detected issues</Text>
          {(analysis.issue_list ?? []).slice(0, 3).map((item) => (
            <Text key={item.id} style={styles.note}>
              • {item.id} ({Math.round(item.confidence * 100)}%)
            </Text>
          ))}
          <Text style={styles.title}>Recommendations</Text>
          {analysis.recommendations.map((note) => (
            <Text key={note} style={styles.note}>
              • {note}
            </Text>
          ))}
          <Text style={styles.title}>Capability notes</Text>
          {analysis.capability_notes.map((note) => (
            <Text key={note} style={styles.note}>
              • {note}
            </Text>
          ))}
          {analysis.clamp_explanations?.length ? (
            <>
              <Text style={styles.title}>Clamp explanations</Text>
              {analysis.clamp_explanations.map((note, index) => (
                <Text key={`${note}-${index}`} style={styles.note}>
                  • {note}
                </Text>
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : null}

      {loading && <ActivityIndicator style={styles.loader} />}
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1

                {/* Recommendations */}
                <View>
                  <Text style={styles.sectionSubtitle}>Recommendations</Text>
                  {response.recommendations?.length ? (
                    response.recommendations.map((rec, idx) => (
                      <Text key={`${rec}-${idx}`} style={styles.bullet}>
                        • {rec}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No recommendations generated.</Text>
                  )}
                </View>

                {/* Capability notes */}
                <View>
                  <Text style={styles.sectionSubtitle}>Capability notes</Text>
                  {response.capability_notes?.length ? (
                    response.capability_notes.map((note, idx) => (
                      <Text key={`${note}-${idx}`} style={styles.bullet}>
                        • {note}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No capability notes available.</Text>
                  )}
                </View>

                {/* Export */}
                <View>
                  <Text style={styles.sectionSubtitle}>Export slicer diff</Text>
                  <Pressable
                    style={[styles.exportPrimaryButton, !response.slicer_profile_diff && styles.disabled]}
                    onPress={handleExportDiff}
                    disabled={!response.slicer_profile_diff}
                  >
                    <Text style={styles.exportPrimaryLabel}>Export slicer diff</Text>
                  </Pressable>

                  <View style={styles.buttonRow}>
                    {SLICERS.map((s) => (
                      <Pressable key={s.id} onPress={() => handleCopyForSlicer(s.id)} style={styles.exportButton}>
                        <Text style={styles.exportLabel}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {exportMessage ? <Text style={styles.exportMessage}>{exportMessage}</Text> : null}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>Run an analysis to see results.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>Select a machine to continue.</Text>
        )}
      </ScrollView>
    </View>
  );
};

/* -------------------------------- styles -------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  errorBox: { backgroundColor: '#7f1d1d', padding: 12, borderRadius: 8, margin: 16 },
  errorText: { color: '#fecaca' },
  tabBar: { flexGrow: 0, paddingHorizontal: 12, paddingTop: 12 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginRight: 8,
  },
  tabActive: { backgroundColor: '#38bdf8' },
  tabLabel: { color: '#cbd5f5' },
  tabLabelActive: { color: '#0f172a', fontWeight: '700' },
  content: { padding: 16 },
  card: { backgroundColor: '#111c2c', borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  subtle: { color: '#93c5fd' },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryLabel: { color: '#0f172a', fontWeight: '700' },
  emptyText: { color: '#94a3b8', fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
<<<<<<< HEAD
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowLabel: { color: '#e2e8f0', fontWeight: '600' },
  rowValue: { color: '#38bdf8', fontVariant: ['tabular-nums'] },
  bullet: { color: '#e2e8f0', marginBottom: 4 },
  exportPrimaryButton: {
=======
  },
  secondaryLabel: {
    color: '#e2e8f0',
  },
  loader: {
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fecaca',
  },
  error: {
    color: '#fca5a5',
  },
  scroll: {
    flex: 1,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  parameterList: {
    gap: 8,
    marginBottom: 16,
  },
  parameterRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
  },
  parameterName: {
    color: '#cbd5f5',
    fontWeight: '500',
  },
  parameterValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  parameterRange: {
    color: '#94a3b8',
  },
  note: {
    color: '#cbd5f5',
    marginBottom: 4,
  },
  diffBox: {
    marginTop: 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  diffPreview: {
    color: '#cbd5f5',
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexGrow: 1,
    alignItems: 'center',
    minWidth: '45%',
  },
  exportLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
  copied: {
    color: '#22d3ee',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 18,
  },
  primaryButton: {
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  exportPrimaryLabel: { color: '#0f172a', fontWeight: '700' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  exportButton: { backgroundColor: '#1f2937', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  exportLabel: { color: '#38bdf8', fontWeight: '600' },
  exportMessage: { color: '#22c55e', marginTop: 8 },
  secondaryButton: {
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryLabel: { color: '#e0f2fe', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

export default ResultsScreen;
