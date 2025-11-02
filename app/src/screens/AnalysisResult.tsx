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
  LayoutChangeEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { exportProfile } from '../api/client';
import type {
  AnalyzeResponse,
  ExperienceLevel,
  MachineRef,
  MachineSummary,
  SlicerId,
} from '../types';

// ---------------------------------------------
// Utilities
// ---------------------------------------------
const SLICERS: Array<{ id: SlicerId; label: string }> = [
  { id: 'cura', label: 'Export for Cura' },
  { id: 'prusaslicer', label: 'Export for PrusaSlicer' },
  { id: 'bambu', label: 'Export for Bambu Studio' },
  { id: 'orca', label: 'Export for OrcaSlicer' },
];

function pct(n: number) {
  return Math.max(0, Math.min(1, n));
}

function formatPct01(n: number) {
  return `${Math.round(pct(n) * 100)}%`;
}

function normalizeHeatmap(resp: AnalyzeResponse): string | null {
  if (resp.localization?.heatmap) {
    const h = resp.localization.heatmap;
    if (typeof h === 'string') return h;
    if (h && typeof h === 'object' && 'data_url' in h) return (h as any).data_url as string;
  }
  if (resp.heatmap) return resp.heatmap;
  return null;
}

type NormBox = { left: number; top: number; width: number; height: number; label: string };

function normalizeBoxes(resp: AnalyzeResponse): NormBox[] {
  const src = resp.localization?.boxes ?? resp.boxes ?? [];
  return (src ?? []).map((b) => {
    const width = typeof b.width === 'number' ? b.width : (b.w ?? 0);
    const height = typeof b.height === 'number' ? b.height : (b.h ?? 0);
    const label = b.issue_id ? `${b.issue_id}${b.confidence ? ` · ${formatPct01(b.confidence)}` : ''}` : 'region';
    return {
      left: pct(b.x),
      top: pct(b.y),
      width: pct(width),
      height: pct(height),
      label,
    };
  });
}

function getParamTargets(resp: AnalyzeResponse): Record<string, string | number> {
  const targets = resp.parameter_targets ?? {};
  // applied can be either a flat params object or { parameters, ... }
  if (resp.applied && typeof resp.applied === 'object' && !Array.isArray(resp.applied)) {
    const maybe = (resp.applied as any).parameters ?? resp.applied;
    // Avoid copying non-param metadata keys if applied is the richer object
    if ((resp.applied as any).parameters) {
      return { ...targets, ...(maybe as Record<string, string | number>) };
    }
    // If it's a flat map and seems like params, merge
    const flat = { ...(maybe as Record<string, string | number>) };
    // Strip likely metadata keys if present
    delete (flat as any).hidden_parameters;
    delete (flat as any).experience_level;
    delete (flat as any).clamped_to_machine_limits;
    delete (flat as any).explanations;
    return { ...targets, ...flat };
  }
  return { ...targets };
}

function getAppliedHidden(resp: AnalyzeResponse): string[] {
  if (resp.hidden_parameters) return resp.hidden_parameters;
  if (resp.applied && typeof resp.applied === 'object') {
    const hp = (resp.applied as any).hidden_parameters;
    if (Array.isArray(hp)) return hp as string[];
  }
  return [];
}

function getExplanations(resp: AnalyzeResponse): string[] {
  if (Array.isArray(resp.explanations)) return resp.explanations;
  if (Array.isArray(resp.clamp_explanations)) return resp.clamp_explanations;
  return [];
}

// ---------------------------------------------
// Component
// ---------------------------------------------
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

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  machine,
  response,
  experience,
  material,
  onClose,
  onRetake,
  image,
}) => {
  // Derived fields
  const predictions = useMemo(
    () => (response.predictions ?? response.issue_list ?? []),
    [response.predictions, (response as any).issue_list]
  );
  const topIssue =
    response.top_issue ??
    (predictions.length ? predictions[0].issue_id : 'general_tuning');

  const heatmapUrl = normalizeHeatmap(response);
  const normBoxes = useMemo(() => normalizeBoxes(response), [response]);

  const parameterTargets = useMemo(() => getParamTargets(response), [response]);
  const explanations = useMemo(() => getExplanations(response), [response]);
  const hiddenParameters = useMemo(() => getAppliedHidden(response), [response]);

  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.6);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [copiedSlicer, setCopiedSlicer] = useState<string | null>(null);

  // size of preview container to place boxes with pixels (avoids % style errors in RN)
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPreviewSize({ w: width, h: height });
  }, []);

  useEffect(() => {
    if (!exportMessage) return;
    const t = setTimeout(() => setExportMessage(null), 2500);
    return () => clearTimeout(t);
  }, [exportMessage]);

  // Clean up blob URLs on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !image?.uri || !image.uri.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(image.uri);
  }, [image?.uri]);

  // Download helper (web)
  const downloadBlob = useCallback((content: string, filename: string, mime: string) => {
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
  }, []);

  // Export slicer diff (web: download; native: copy)
  const handleExportSlicerDiff = useCallback(() => {
    const diff = response.slicer_profile_diff;
    if (!diff) {
      Alert.alert('No diff available', 'The server did not provide a slicer profile diff.');
      return;
    }
    const baseName = `${machine.id}-slicer-diff`;
    const jsonPayload = JSON.stringify(diff, null, 2);

    if (Platform.OS === 'web') {
      downloadBlob(jsonPayload, `${baseName}.json`, 'application/json');
      if (diff.markdown) {
        downloadBlob(diff.markdown, `${baseName}.md`, 'text/markdown');
        setExportMessage('Downloaded JSON + Markdown diff.');
      } else {
        setExportMessage('Downloaded JSON diff.');
      }
      return;
    }

    const text = diff.markdown ?? jsonPayload;
    Clipboard.setStringAsync(text).then(() => {
      Alert.alert('Export ready', diff.markdown ? 'Markdown copied to clipboard.' : 'JSON copied to clipboard.');
      setExportMessage('Export copied to clipboard.');
    });
  }, [downloadBlob, machine.id, response.slicer_profile_diff]);

  // Copy “changes for slicer” via API
  const aggregatedChanges: Record<string, string | number> = useMemo(() => {
    // We expose parameter_targets as the recommended “target” changes
    return { ...parameterTargets };
  }, [parameterTargets]);

  const handleExportToSlicer = useCallback(async (slicer: SlicerId) => {
    try {
      const res = await exportProfile({ slicer, changes: aggregatedChanges });
      await Clipboard.setStringAsync(JSON.stringify(res.diff ?? res, null, 2));
      setCopiedSlicer(slicer);
      setTimeout(() => setCopiedSlicer(null), 2500);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  }, [aggregatedChanges]);

  return (
    <View style={styles.container}>
      {/* Header */}
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
        {/* Photo + overlays */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo localization</Text>
          {image ? (
            <View style={styles.previewContainer} onLayout={onPreviewLayout}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              {heatmapUrl ? (
                <Image
                  source={{ uri: heatmapUrl }}
                  style={[styles.previewImage, { opacity: overlayOpacity }]}
                />
              ) : null}

              {/* Bounding boxes in pixels */}
              {previewSize.w > 0 && previewSize.h > 0 && normBoxes.map((b, idx) => {
                const left = b.left * previewSize.w;
                const top = b.top * previewSize.h;
                const width = b.width * previewSize.w;
                const height = b.height * previewSize.h;
                return (
                  <View
                    key={`box-${idx}`}
                    style={[styles.boundingBox, { left, top, width, height }]}
                  >
                    <Text style={styles.boundingLabel}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyFacts}>Photo preview unavailable.</Text>
          )}

          {/* Opacity buttons (no slider dependency) */}
          {heatmapUrl ? (
            <View style={styles.opacityRow}>
              <Text style={styles.overlayLabel}>Heatmap opacity</Text>
              <View style={styles.opacityButtons}>
                <Pressable
                  onPress={() => setOverlayOpacity((v) => Math.max(0, Math.round((v - 0.05) * 100) / 100))}
                  style={styles.bumpButton}
                >
                  <Text style={styles.bumpLabel}>-</Text>
                </Pressable>
                <Text style={styles.opacityValue}>{Math.round(overlayOpacity * 100)}%</Text>
                <Pressable
                  onPress={() => setOverlayOpacity((v) => Math.min(1, Math.round((v + 0.05) * 100) / 100))}
                  style={styles.bumpButton}
                >
                  <Text style={styles.bumpLabel}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Predictions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predicted issues</Text>
          {predictions.length ? (
            predictions.map((p, i) => (
              <View key={`${p.issue_id}-${i}`} style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>{p.issue_id}</Text>
                <Text style={styles.predictionConfidence}>{formatPct01(p.confidence)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No predictions returned.</Text>
          )}
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {response.recommendations?.length ? (
            response.recommendations.map((rec, idx) => (
              <Text key={`${idx}-${rec}`} style={styles.note}>• {rec}</Text>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No recommendations generated.</Text>
          )}
        </View>

        {/* Capability notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capability notes</Text>
          {response.capability_notes?.length ? (
            response.capability_notes.map((n, idx) => (
              <Text key={`${idx}-${n}`} style={styles.note}>• {n}</Text>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No capability notes available.</Text>
          )}
        </View>

        {/* Parameter targets (merged view) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested parameter targets</Text>
          {Object.keys(parameterTargets).length ? (
            Object.entries(parameterTargets).map(([k, v]) => (
              <View key={k} style={styles.paramRow}>
                <Text style={styles.paramName}>{k}</Text>
                <Text style={styles.paramValue}>{String(v)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyFacts}>No parameter guidance.</Text>
          )}
          {!!hiddenParameters.length && (
            <Text style={styles.note}>
              Hidden parameters: {hiddenParameters.join(', ')}
            </Text>
          )}
          {!!explanations.length && (
            <Text style={styles.note}>
              Notes: {explanations.join(' · ')}
            </Text>
          )}
        </View>

        {/* Export slicer diff */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export slicer diff</Text>
          <Pressable style={styles.primaryWide} onPress={handleExportSlicerDiff}>
            <Text style={styles.primaryWideLabel}>Export slicer diff</Text>
          </Pressable>
          {exportMessage ? <Text style={styles.exportStatus}>{exportMessage}</Text> : null}
        </View>

        {/* Quick copy for slicers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Copy for slicer</Text>
          <View style={styles.buttonRow}>
            {SLICERS.map((s) => (
              <Pressable key={s.id} style={styles.exportButton} onPress={() => handleExportToSlicer(s.id)}>
                <Text style={styles.exportLabel}>
                  {copiedSlicer === s.id ? 'Copied!' : s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------
// Styles
// ---------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  subtitle: { color: '#cbd5f5', marginTop: 4 },
  topIssue: { marginTop: 6, color: '#facc15', fontWeight: '600' },

  primaryButton: { backgroundColor: '#38bdf8', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  primaryLabel: { color: '#0f172a', fontWeight: '700' },
  secondaryButton: { borderColor: '#38bdf8', borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryLabel: { color: '#e0f2fe', fontWeight: '600' },
  smallButton: { paddingHorizontal: 16, paddingVertical: 8 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20 },

  section: { gap: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  emptyFacts: { color: '#94a3b8', fontStyle: 'italic' },

  previewContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111c2c',
    position: 'relative',
  },
  previewImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },

  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'solid',
    borderRadius: 6,
  },
  boundingLabel: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  opacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlayLabel: { color: '#cbd5f5', fontSize: 12 },
  opacityButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bumpButton: { backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  bumpLabel: { color: '#e2e8f0', fontWeight: '700', fontSize: 16 },
  opacityValue: { color: '#f8fafc', fontVariant: ['tabular-nums'] },

  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111c2c',
    borderRadius: 12,
    padding: 12,
  },
  predictionLabel: { color: '#e2e8f0', fontWeight: '600' },
  predictionConfidence: { color: '#38bdf8', fontVariant: ['tabular-nums'] },

  // Parameters
  paramRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paramName: { color: '#f1f5f9' },
  paramValue: { color: '#cbd5f5', fontVariant: ['tabular-nums'] },

  note: { color: '#94a3b8' },

  // Export diff primary button
  primaryWide: { backgroundColor: '#38bdf8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryWideLabel: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  exportStatus: { color: '#38bdf8' },

  // Export buttons row
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exportButton: { backgroundColor: '#1f2937', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  exportLabel: { color: '#38bdf8', fontWeight: '600' },
});
