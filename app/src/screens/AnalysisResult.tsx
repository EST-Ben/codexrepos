import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';

import { exportProfile } from '../api/client';
import type {
  AnalyzeResponse,
  ExperienceLevel,
  MachineRef,
  MachineSummary,
  SlicerId,
} from '../types';

const SLICERS: Array<{ id: SlicerId; label: string }> = [
  { id: 'cura', label: 'Export for Cura' },
  { id: 'prusaslicer', label: 'Export for PrusaSlicer' },
  { id: 'bambu', label: 'Export for Bambu Studio' },
  { id: 'orca', label: 'Export for OrcaSlicer' },
];

interface AnalysisResultProps {
  machine: MachineRef;
  response: AnalyzeResponse;
  experience: ExperienceLevel;
  material?: string;
  machineSummary?: MachineSummary;
  onClose(): void;
  onRetake(): void;
  image?: { uri: string; width: number; height: number };
}

function formatConfidence(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function clamp01(value: number | undefined | null): number {
  if (typeof value !== 'number') {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  machine,
  response,
  experience,
  material,
  machineSummary,
  onClose,
  onRetake,
  image,
}) => {
  const [adjustments, setAdjustments] = useState<Record<string, AdjustmentValue>>(() =>
    initialiseAdjustments(response.suggestions),
  );
  const [copied, setCopied] = useState<SlicerId | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.6);

  const sortedIssues = useMemo(() => {
    return [...(response.issue_list ?? [])].sort((a, b) => b.confidence - a.confidence);
  }, [response.issue_list]);

  const parameterKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(response.parameter_targets ?? {}).forEach((key) => keys.add(key));
    Object.keys(response.applied ?? {}).forEach((key) => keys.add(key));
    return Array.from(keys).sort();
  }, [response.parameter_targets, response.applied]);

  const aspectRatio = useMemo(() => {
    if (image?.width && image?.height) {
      return image.width / image.height;
    }
    return 4 / 3;
  }, [image]);

  const heatmap = response.localization?.heatmap;
  const boundingBoxes = response.localization?.boxes ?? [];

  const downloadBlob = useCallback((content: string, filename: string, mime: string) => {
    if (Platform.OS !== 'web') {
      return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadDiff = useCallback(async () => {
    const diff = response.slicer_profile_diff;
    const baseName = `${machine.id}-slicer-diff`;
    const jsonPayload = JSON.stringify(diff, null, 2);
    if (Platform.OS === 'web') {
      downloadBlob(jsonPayload, `${baseName}.json`, 'application/json');
      if (diff.markdown) {
        downloadBlob(diff.markdown, `${baseName}.md`, 'text/markdown');
        setExportMessage('Downloaded JSON + Markdown diff');
      } else {
        setExportMessage('Downloaded JSON diff');
      }
      return;
    }

    const text = diff.markdown ?? jsonPayload;
    await Clipboard.setStringAsync(text);
    Alert.alert('Export ready', diff.markdown ? 'Markdown copied to clipboard.' : 'JSON copied to clipboard.');
    setExportMessage('Export copied to clipboard');
  }, [response.slicer_profile_diff, machine.id, downloadBlob]);

  useEffect(() => {
    if (!exportMessage) {
      return;
    }
    const timer = setTimeout(() => setExportMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [exportMessage]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !image?.uri || !image.uri.startsWith('blob:')) {
      return;
    }
    return () => {
      URL.revokeObjectURL(image.uri);
    };
  }, [image?.uri]);

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
            </View>
          );
        })}
      </View>
      <Text style={styles.riskLabel}>Risk: {suggestion.risk}</Text>
      <Text style={styles.confidenceLabel}>Confidence: {(suggestion.confidence * 100).toFixed(0)}%</Text>
      {suggestion.clamped_to_machine_limits && (
        <Text style={styles.clampedNote}>Some values were clamped to your machine limits.</Text>
      )}
      {suggestion.beginner_note && (
        <Text style={styles.note}>Beginner tip: {suggestion.beginner_note}</Text>
      )}
      {suggestion.advanced_note && (
        <Text style={styles.note}>Advanced tip: {suggestion.advanced_note}</Text>
      )}
    </View>
  );

  useEffect(() => {
    if (!exportMessage) {
      return;
    }
    const timer = setTimeout(() => setExportMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [exportMessage]);

  const topIssue = response.top_issue ?? sortedIssues[0]?.id ?? 'general_tuning';
  const boxes = response.boxes ?? [];
  const clampNotes = response.clamp_explanations ?? [];
  const hiddenParameters = response.hidden_parameters ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Analysis complete</Text>
          <Text style={styles.subtitle}>
            {machine.brand} {machine.model} • Experience: {experience}
            {material ? ` • Material: ${material}` : ''}
          </Text>
          <Text style={styles.topIssue}>Top issue: {topIssue}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onRetake} style={[styles.secondaryButton, styles.smallButton]}>
            <Text style={styles.secondaryLabel}>Retake</Text>
          </Pressable>
          <Pressable onPress={onClose} style={[styles.primaryButton, styles.smallButton]}>
            <Text style={styles.primaryLabel}>Close</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {image ? (
          <View style={[styles.preview, { aspectRatio }]}>
            <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            {response.heatmap ? (
              <Image
                source={{ uri: response.heatmap }}
                style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}
                resizeMode="cover"
              />
            ) : null}
            {boxes.map((box, index) => {
              const left = `${clamp01(box.x) * 100}%`;
              const top = `${clamp01(box.y) * 100}%`;
              const width = `${clamp01(box.w) * 100}%`;
              const height = `${clamp01(box.h) * 100}%`;
              return (
                <View
                  key={`${box.issue_id ?? 'box'}-${index}`}
                  style={[styles.boundingBox, { left, top, width, height }]}
                >
                  <Text style={styles.boundingLabel}>
                    {box.issue_id ?? 'region'} {box.score ? `(${formatConfidence(clamp01(box.score))})` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

      <ScrollView style={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo localization</Text>
          {image ? (
            <View style={[styles.previewContainer, { aspectRatio }]}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              {heatmap ? (
                <Image
                  source={{ uri: heatmap.data_url }}
                  style={[styles.previewImage, styles.heatmapOverlay, { opacity: overlayOpacity }]}
                />
              ) : null}
              {boundingBoxes.map((box, index) => (
                <View
                  key={`${box.issue_id}-${index}`}
                  style={[
                    styles.boundingBox,
                    {
                      left: `${(box.x * 100).toFixed(1)}%`,
                      top: `${(box.y * 100).toFixed(1)}%`,
                      width: `${(box.width * 100).toFixed(1)}%`,
                      height: `${(box.height * 100).toFixed(1)}%`,
                    },
                  ]}
                >
                  <Text style={styles.boundingLabel}>
                    {box.issue_id} · {(box.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyFacts}>Photo preview unavailable.</Text>
          )}
          {heatmap ? (
            <View style={styles.overlayControls}>
              <Text style={styles.overlayLabel}>Heatmap opacity</Text>
              <Slider
                style={styles.overlaySlider}
                minimumValue={0}
                maximumValue={1}
                value={overlayOpacity}
                minimumTrackTintColor="#38bdf8"
                maximumTrackTintColor="#1f2937"
                thumbTintColor="#38bdf8"
                step={0.05}
                onValueChange={setOverlayOpacity}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predicted issues</Text>
          {response.predictions.length ? (
            response.predictions.map((prediction) => (
              <View key={prediction.issue_id} style={styles.predictionCard}>
                <Text style={styles.predictionLabel}>{prediction.issue_id}</Text>
                <Text style={styles.predictionConfidence}>{(prediction.confidence * 100).toFixed(0)}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No predictions returned.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {response.recommendations.length ? (
            response.recommendations.map((rec, index) => (
              <Text key={`${rec}-${index}`} style={styles.note}>
                • {rec}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No recommendations generated.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capability notes</Text>
          {response.capability_notes.length ? (
            response.capability_notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.note}>
                • {note}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No capability notes available.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {response.suggestions.map(renderSuggestion)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export slicer diff</Text>
          <Pressable style={styles.exportPrimaryButton} onPress={handleDownloadDiff}>
            <Text style={styles.exportPrimaryLabel}>Export slicer diff</Text>
          </Pressable>
          {exportMessage ? <Text style={styles.exportStatus}>{exportMessage}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Copy for slicer</Text>
          <View style={styles.exportButtons}>
            {SLICERS.map((item) => (
              <Pressable key={item.id} onPress={() => handleExport(item.id)} style={styles.exportButton}>
                <Text style={styles.exportLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {exportMessage ? <Text style={styles.exportMessage}>{exportMessage}</Text> : null}
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#cbd5f5',
    marginTop: 4,
  },
  topIssue: {
    marginTop: 6,
    color: '#facc15',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  secondaryLabel: {
    color: '#e0f2fe',
    fontWeight: '600',
  },
  smallButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  emptyFacts: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111c2c',
    position: 'relative',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  heatmapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  boundingLabel: {
    backgroundColor: 'rgba(56, 189, 248, 0.85)',
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  overlayControls: {
    gap: 8,
  },
  overlayLabel: {
    color: '#cbd5f5',
    fontSize: 12,
  },
  overlaySlider: {
    width: '100%',
  },
  predictionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111c2c',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'solid',
    justifyContent: 'flex-start',
  },
  boundingLabel: {
    backgroundColor: 'rgba(249, 115, 22, 0.85)',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  suggestionCard: {
    backgroundColor: '#111c2c',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#94a3b8',
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueName: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  issueConfidence: {
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  parameterName: {
    flex: 2,
    color: '#f1f5f9',
  },
  parameterValue: {
    flex: 1,
    textAlign: 'right',
    color: '#cbd5f5',
    fontVariant: ['tabular-nums'],
  },
  parameterApplied: {
    flex: 1,
    textAlign: 'right',
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  exportPrimaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exportPrimaryLabel: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  exportStatus: {
    color: '#38bdf8',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exportButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportLabel: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  exportMessage: {
    color: '#22c55e',
    marginTop: 8,
  },
});
