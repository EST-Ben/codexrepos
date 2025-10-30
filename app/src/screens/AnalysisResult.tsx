import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Slider from '@react-native-community/slider';

import { exportProfile } from '../api/client';
import type {
  AnalyzeResponse,
  ExperienceLevel,
  MachineRef,
  MachineSummary,
  Suggestion,
  SuggestionChange,
  SlicerId,
} from '../types';

const SLICERS: Array<{ id: SlicerId; label: string }> = [
  { id: 'cura', label: 'Copy for Cura' },
  { id: 'prusaslicer', label: 'Copy for PrusaSlicer' },
  { id: 'bambu', label: 'Copy for Bambu Studio' },
  { id: 'orca', label: 'Copy for OrcaSlicer' },
];

interface AdjustmentValue {
  type: 'delta' | 'target';
  value: number;
  change: SuggestionChange;
}

interface AnalysisResultProps {
  machine: MachineRef;
  response: AnalyzeResponse;
  experience: ExperienceLevel;
  material?: string;
  machineSummary?: MachineSummary;
  onClose(): void;
  onRetake(): void;
}

function deriveBounds(param: string, summary?: MachineSummary): { min: number; max: number } {
  const fallback = { min: 0, max: 100 };
  if (!summary) {
    if (param.includes('temp')) {
      return { min: 0, max: 320 };
    }
    if (param.includes('speed')) {
      return { min: 0, max: 350 };
    }
    return fallback;
  }

  if (param.includes('nozzle')) {
    return { min: 0, max: summary.max_nozzle_temp_c ?? 320 };
  }
  if (param.includes('bed')) {
    return { min: 0, max: summary.max_bed_temp_c ?? 140 };
  }
  if (param.includes('print_speed') && summary.safe_speed_ranges?.print) {
    return { min: summary.safe_speed_ranges.print[0], max: summary.safe_speed_ranges.print[1] };
  }
  if (param.includes('travel') && summary.safe_speed_ranges?.travel) {
    return { min: summary.safe_speed_ranges.travel[0], max: summary.safe_speed_ranges.travel[1] };
  }
  if (param.includes('accel') && summary.safe_speed_ranges?.accel) {
    return { min: summary.safe_speed_ranges.accel[0], max: summary.safe_speed_ranges.accel[1] };
  }
  if (param.includes('jerk') && summary.safe_speed_ranges?.jerk) {
    return { min: summary.safe_speed_ranges.jerk[0], max: summary.safe_speed_ranges.jerk[1] };
  }
  if (param.includes('spindle') && summary.spindle_rpm_range) {
    return { min: summary.spindle_rpm_range[0], max: summary.spindle_rpm_range[1] };
  }
  if (param.includes('feed') && summary.max_feed_mm_min) {
    return { min: 0, max: summary.max_feed_mm_min };
  }
  if (param.includes('fan')) {
    return { min: 0, max: 100 };
  }
  if (param.includes('flow')) {
    return { min: 80, max: 140 };
  }
  if (param.includes('retraction')) {
    return { min: 0, max: 3 };
  }
  return fallback;
}

function initialiseAdjustments(suggestions: Suggestion[]): Record<string, AdjustmentValue> {
  const entries: Array<[string, AdjustmentValue]> = [];
  suggestions.forEach((suggestion) => {
    suggestion.changes.forEach((change) => {
      const key = `${suggestion.issue_id}:${change.param}`;
      const value = change.new_target ?? change.delta ?? 0;
      entries.push([
        key,
        {
          type: change.new_target === undefined ? 'delta' : 'target',
          value,
          change,
        },
      ]);
    });
  });
  return Object.fromEntries(entries);
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  machine,
  response,
  experience,
  material,
  machineSummary,
  onClose,
  onRetake,
}) => {
  const [adjustments, setAdjustments] = useState<Record<string, AdjustmentValue>>(() =>
    initialiseAdjustments(response.suggestions),
  );
  const [copied, setCopied] = useState<SlicerId | null>(null);

  useEffect(() => {
    setAdjustments(initialiseAdjustments(response.suggestions));
  }, [response]);

  const aggregatedChanges = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(adjustments).forEach(([key, entry]) => {
      const param = entry.change.param;
      result[param] = entry.value;
    });
    return result;
  }, [adjustments]);

  const handleExport = async (slicer: SlicerId) => {
    const diff = await exportProfile({ slicer, changes: aggregatedChanges });
    await Clipboard.setStringAsync(JSON.stringify(diff.diff, null, 2));
    setCopied(slicer);
    setTimeout(() => setCopied(null), 2500);
  };

  const renderSuggestion = (suggestion: Suggestion) => (
    <View key={suggestion.issue_id} style={styles.suggestionCard}>
      <Text style={styles.suggestionTitle}>Fix {suggestion.issue_id}</Text>
      <Text style={styles.suggestionWhy}>{suggestion.why}</Text>
      <View style={styles.changesList}>
        {suggestion.changes.map((change) => {
          const key = `${suggestion.issue_id}:${change.param}`;
          const state = adjustments[key];
          const bounds = change.range_hint
            ? { min: change.range_hint[0], max: change.range_hint[1] }
            : deriveBounds(change.param, machineSummary);
          const unit = change.unit ? ` ${change.unit}` : '';
          return (
            <View key={key} style={styles.changeRow}>
              <Text style={styles.changeLabel}>{change.param}</Text>
              <View style={styles.sliderRow}>
                <Pressable
                  accessibilityHint="Decrease value"
                  onPress={() =>
                    setAdjustments((prev) => ({
                      ...prev,
                      [key]: {
                        ...state,
                        value: Math.max(bounds.min, state.value - Math.max(1, (bounds.max - bounds.min) / 20)),
                      },
                    }))
                  }
                  style={styles.bumpButton}
                >
                  <Text style={styles.bumpLabel}>-</Text>
                </Pressable>
                <Slider
                  style={styles.slider}
                  minimumValue={bounds.min}
                  maximumValue={bounds.max}
                  value={state?.value ?? bounds.min}
                  minimumTrackTintColor="#38bdf8"
                  maximumTrackTintColor="#1f2937"
                  thumbTintColor="#38bdf8"
                  step={Math.max((bounds.max - bounds.min) / 100, 0.1)}
                  onValueChange={(value) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      [key]: {
                        ...state,
                        value,
                      },
                    }))
                  }
                />
                <Pressable
                  accessibilityHint="Increase value"
                  onPress={() =>
                    setAdjustments((prev) => ({
                      ...prev,
                      [key]: {
                        ...state,
                        value: Math.min(bounds.max, state.value + Math.max(1, (bounds.max - bounds.min) / 20)),
                      },
                    }))
                  }
                  style={styles.bumpButton}
                >
                  <Text style={styles.bumpLabel}>+</Text>
                </Pressable>
              </View>
              <View style={styles.valueDisplay}>
                <Text style={styles.valueText}>{state?.value.toFixed(2)}{unit}</Text>
                <Text style={styles.rangeText}>
                  Range {bounds.min.toFixed(1)} – {bounds.max.toFixed(1)}{unit}
                </Text>
              </View>
              {state?.type === 'delta' && change.delta !== undefined && (
                <Text style={styles.deltaNote}>Recommended change: {change.delta > 0 ? '+' : ''}{change.delta}{unit}</Text>
              )}
              {change.beginner_note && experience === 'Beginner' && (
                <Text style={styles.note}>{change.beginner_note}</Text>
              )}
              {change.advanced_note && experience === 'Advanced' && (
                <Text style={styles.note}>{change.advanced_note}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.riskLabel}>Risk: {suggestion.risk}</Text>
      <Text style={styles.confidenceLabel}>Confidence: {(suggestion.confidence * 100).toFixed(0)}%</Text>
      {suggestion.clamped_to_machine_limits && (
        <Text style={styles.clampedNote}>Some values were clamped to your machine limits.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{machine.brand} {machine.model}</Text>
          <Text style={styles.subtitle}>Experience: {experience} · Material: {material ?? 'Not set'}</Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable onPress={onRetake} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Retake</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>New photo</Text>
          </Pressable>
        </View>
      </View>

      {response.low_confidence && (
        <View style={styles.lowConfidenceBanner}>
          <Text style={styles.lowConfidenceTitle}>Low confidence result</Text>
          <Text style={styles.lowConfidenceText}>
            We could not confidently detect issues. Review the generic checklist and try another photo.
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll}>
        <View style={styles.predictionSection}>
          <Text style={styles.sectionTitle}>Predicted issues</Text>
          {response.predictions.map((prediction) => (
            <View key={prediction.issue_id} style={styles.predictionCard}>
              <Text style={styles.predictionLabel}>{prediction.issue_id}</Text>
              <Text style={styles.predictionConfidence}>{(prediction.confidence * 100).toFixed(0)}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.suggestionsSection}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {response.suggestions.map(renderSuggestion)}
        </View>

        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export profile changes</Text>
          <View style={styles.exportButtons}>
            {SLICERS.map((item) => (
              <Pressable key={item.id} style={styles.exportButton} onPress={() => handleExport(item.id)}>
                <Text style={styles.exportLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {copied && <Text style={styles.copied}>Copied diff for {copied}</Text>}
        </View>
      </ScrollView>
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#cbd5f5',
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
    fontWeight: '500',
  },
  lowConfidenceBanner: {
    backgroundColor: '#7c2d12',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  lowConfidenceTitle: {
    color: '#fed7aa',
    fontWeight: '700',
  },
  lowConfidenceText: {
    color: '#fed7aa',
  },
  scroll: {
    flex: 1,
  },
  predictionSection: {
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  predictionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111c2c',
    borderRadius: 12,
    padding: 12,
  },
  predictionLabel: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  predictionConfidence: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  suggestionsSection: {
    gap: 16,
  },
  suggestionCard: {
    backgroundColor: '#111c2c',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  suggestionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionWhy: {
    color: '#cbd5f5',
  },
  changesList: {
    gap: 16,
  },
  changeRow: {
    gap: 8,
  },
  changeLabel: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
  },
  bumpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bumpLabel: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  valueDisplay: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
  },
  valueText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 16,
  },
  rangeText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deltaNote: {
    color: '#f97316',
    fontSize: 12,
  },
  note: {
    color: '#cbd5f5',
    fontSize: 12,
  },
  riskLabel: {
    color: '#fbbf24',
    fontSize: 12,
  },
  confidenceLabel: {
    color: '#38bdf8',
    fontSize: 12,
  },
  clampedNote: {
    color: '#f97316',
    fontSize: 12,
  },
  exportSection: {
    marginTop: 24,
    gap: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exportButton: {
    flexBasis: '48%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
  },
  exportLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
  copied: {
    color: '#22d3ee',
  },
});
