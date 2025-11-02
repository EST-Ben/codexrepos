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

function clamp01(value: number | undefined): number {
  if (typeof value !== 'number') {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function toPercent(value: number | undefined): string {
  return `${(clamp01(value) * 100).toFixed(1)}%`;
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
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.65);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const predictions = useMemo(() => response.predictions ?? [], [response.predictions]);
  const topPrediction = predictions[0];
  const heatmapUri = response.localization?.heatmap?.data_url ?? null;
  const boxes = response.localization?.boxes ?? [];
  const appliedEntries = useMemo(
    () => Object.entries(response.applied ?? {}) as Array<[string, string | number]>,
    [response.applied],
  );
  const diffEntries = useMemo(
    () =>
      Object.entries(response.slicer_profile_diff?.diff ?? {}) as Array<[
        string,
        string | number | boolean,
      ]>,
    [response.slicer_profile_diff?.diff],
  );

  const aspectRatio = useMemo(() => {
    if (image?.width && image?.height) {
      return Math.max(image.width, 1) / Math.max(image.height, 1);
    }
    return 4 / 3;
  }, [image]);

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

  const handleExport = useCallback(
    async (slicer: SlicerId) => {
      try {
        const changes = Object.keys(response.applied ?? {}).length
          ? (response.applied as Record<string, string | number | boolean>)
          : response.slicer_profile_diff?.diff ?? {};
        const diff = await exportProfile({ slicer, changes });
        const baseName = `${machine.id}-${slicer}-profile`;
        const markdown = response.slicer_profile_diff?.markdown ?? null;
        const jsonPayload = JSON.stringify(diff, null, 2);

        if (Platform.OS === 'web') {
          downloadBlob(jsonPayload, `${baseName}.json`, 'application/json');
          if (markdown) {
            downloadBlob(markdown, `${baseName}.md`, 'text/markdown');
            setExportMessage('Downloaded JSON + Markdown diff');
          } else {
            setExportMessage('Downloaded JSON diff');
          }
          return;
        }

        const clipboardText = markdown ?? jsonPayload;
        await Clipboard.setStringAsync(clipboardText);
        setExportMessage(markdown ? 'Markdown copied to clipboard.' : 'JSON diff copied to clipboard.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert('Export failed', message || 'Unable to generate slicer diff.');
      }
    },
    [downloadBlob, machine.id, response.applied, response.slicer_profile_diff?.diff, response.slicer_profile_diff?.markdown],
  );

  useEffect(() => {
    if (!exportMessage) {
      return;
    }
    const timer = setTimeout(() => setExportMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [exportMessage]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Analysis complete</Text>
          <Text style={styles.subtitle}>
            {machine.brand} {machine.model} • Experience: {experience}
            {material ? ` • Material: ${material}` : ''}
          </Text>
          {topPrediction ? (
            <Text style={styles.topIssue}>
              Top issue: {topPrediction.issue_id} ({toPercent(topPrediction.confidence)})
            </Text>
          ) : (
            <Text style={styles.topIssue}>No dominant issue detected.</Text>
          )}
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
            {heatmapUri ? (
              <Image
                source={{ uri: heatmapUri }}
                style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}
                resizeMode="cover"
              />
            ) : null}
            {boxes.map((box, index) => {
              const left = `${clamp01(box.x) * 100}%` as any;
              const top = `${clamp01(box.y) * 100}%` as any;
              const width = `${clamp01(box.width) * 100}%` as any;
              const height = `${clamp01(box.height) * 100}%` as any;
              return (
                <View
                  key={`${box.issue_id}-${index}`}
                  style={[styles.boundingBox, { left, top, width, height }]}
                >
                  <Text style={styles.boundingLabel}>
                    {box.issue_id} {toPercent(box.confidence)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {heatmapUri ? (
          <View style={styles.sliderRow}>
            <Text style={styles.sectionTitle}>Heatmap opacity</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={overlayOpacity}
              onValueChange={setOverlayOpacity}
              minimumTrackTintColor="#38bdf8"
              thumbTintColor="#38bdf8"
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detected issues</Text>
          {predictions.length === 0 ? (
            <Text style={styles.emptyText}>No issues detected.</Text>
          ) : (
            predictions.map((item) => (
              <View key={item.issue_id} style={styles.issueRow}>
                <Text style={styles.issueName}>{item.issue_id}</Text>
                <Text style={styles.issueConfidence}>{toPercent(item.confidence)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applied parameters</Text>
          {appliedEntries.length === 0 ? (
            <Text style={styles.emptyText}>No direct parameter overrides applied.</Text>
          ) : (
            appliedEntries.map(([key, value]) => (
              <View key={key} style={styles.parameterRow}>
                <Text style={styles.parameterName}>{key}</Text>
                <Text style={styles.parameterValue}>{String(value)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile diff</Text>
          {diffEntries.length === 0 ? (
            <Text style={styles.emptyText}>No slicer diff data provided.</Text>
          ) : (
            diffEntries.map(([key, value]) => (
              <View key={key} style={styles.parameterRow}>
                <Text style={styles.parameterName}>{key}</Text>
                <Text style={styles.parameterValue}>{String(value)}</Text>
              </View>
            ))
          )}
        </View>

        {response.recommendations.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {response.recommendations.map((tip) => (
              <Text key={tip} style={styles.bodyText}>
                • {tip}
              </Text>
            ))}
          </View>
        ) : null}

        {response.capability_notes.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Machine capability notes</Text>
            {response.capability_notes.map((note) => (
              <Text key={note} style={styles.bodyText}>
                • {note}
              </Text>
            ))}
          </View>
        ) : null}

        {response.explanations?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clamping explanations</Text>
            {response.explanations.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.bodyText}>
                • {note}
              </Text>
            ))}
          </View>
        ) : null}

        {machineSummary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Machine info</Text>
            {machineSummary.capabilities?.length ? (
              <Text style={styles.bodyText}>Capabilities: {machineSummary.capabilities.join(', ')}</Text>
            ) : null}
            {machineSummary.safe_speed_ranges ? (
              <Text style={styles.bodyText}>
                Safe speeds:
                {Object.entries(machineSummary.safe_speed_ranges)
                  .map(([key, range]) => ` ${key}: ${range.join('–')}`)
                  .join(' | ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export slicer diff</Text>
          <View style={styles.buttonRow}>
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
  scrollContent: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  preview: {
    width: '100%',
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
  sliderRow: {
    gap: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  section: {
    backgroundColor: '#111827',
    borderRadius: 12,
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
  bodyText: {
    color: '#cbd5f5',
    lineHeight: 20,
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

export default AnalysisResult;
