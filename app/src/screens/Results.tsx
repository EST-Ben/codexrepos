import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { analyzeMachine, exportProfile } from '../api/client';
import { filterParametersForExperience, deriveParameterRanges } from '../state/onboarding';
import type { AnalyzeResponse, ExperienceLevel } from '../types';

interface ResultsProps {
  selectedMachines: string[];
  experience: ExperienceLevel;
  onReset(): void;
}

const SLICERS = [
  { id: 'cura', label: 'Copy for Cura' },
  { id: 'prusaslicer', label: 'Copy for PrusaSlicer' },
  { id: 'bambu', label: 'Copy for Bambu Studio' },
  { id: 'orca', label: 'Copy for OrcaSlicer' },
] as const;

export const ResultsScreen: React.FC<ResultsProps> = ({ selectedMachines, experience, onReset }) => {
  const [activeMachine, setActiveMachine] = useState<string | null>(selectedMachines[0] ?? null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMachine) {
      setAnalysis(null);
      return;
    }
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyzeMachine({
          machine: activeMachine,
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
  }, [activeMachine, experience]);

  useEffect(() => {
    setActiveMachine(selectedMachines[0] ?? null);
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
  );

  const copyForSlicer = async (slicer: 'cura' | 'prusaslicer' | 'bambu' | 'orca') => {
    if (!analysis) {
      return;
    }
    const diff = await exportProfile({
      slicer,
      changes: filteredParameters,
    });
    await Clipboard.setStringAsync(JSON.stringify(diff, null, 2));
    setCopied(diff.slicer);
    setTimeout(() => setCopied(null), 2500);
  };

  if (!selectedMachines.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No machines selected yet</Text>
        <Pressable onPress={onReset} style={styles.primaryButton}>
          <Text style={styles.primaryLabel}>Run onboarding</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          {selectedMachines.map((id) => {
            const active = id === activeMachine;
            return (
              <Pressable
                key={id}
                onPress={() => setActiveMachine(id)}
                style={[styles.badge, active && styles.badgeActive]}
              >
                <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>{id}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onReset} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Adjust selections</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {analysis && !loading && (
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
      )}

      <View style={styles.exportRow}>
        {SLICERS.map((item) => (
          <Pressable key={item.id} onPress={() => copyForSlicer(item.id)} style={styles.exportButton}>
            <Text style={styles.exportLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {copied && <Text style={styles.copied}>Copied diff for {copied}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1e293b',
  },
  badgeActive: {
    backgroundColor: '#38bdf8',
  },
  badgeLabel: {
    color: '#cbd5f5',
  },
  badgeLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    color: '#e2e8f0',
  },
  loader: {
    marginTop: 12,
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
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  primaryLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
