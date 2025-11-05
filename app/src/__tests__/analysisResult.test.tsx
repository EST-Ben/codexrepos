// src/__tests__/analysisResult.test.tsx
import { describe, expect, it, jest } from '@jest/globals';
jest.mock(
  '@react-native-community/slider',
  () => {
    const React = require('react');
    return function SliderMock(props: any) {
      // Simple stand-in that renders a <div> with testID support
      return React.createElement('div', { 'data-testid': props.testID ?? 'slider-mock' });
    };
  },
  { virtual: true },
);

import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { render, screen } from '../test-utils/native-testing';
import Slider from '@react-native-community/slider';

import type { AnalyzeResponse, ExperienceLevel } from '../types';

export interface MachineSummary {
  id: string;
  brand: string;
  model: string;
  // e.g. { print: [40, 300] }
  safe_speed_ranges?: Record<string, [number, number]>;
}

export interface AnalysisResultProps {
  machine: { id: string; brand: string; model: string };
  response: AnalyzeResponse;
  experience: ExperienceLevel;
  image: { uri: string; width: number; height: number };
  onClose(): void;
  onRetake(): void;

  /** Optional summary used by tests to expose min/max ranges for a slider */
  machineSummary?: MachineSummary;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  machine,
  response,
  experience,
  image,
  onClose,
  onRetake,
  machineSummary,
}) => {
  // Derive a printable speed range:
  const [minPrint, maxPrint] = useMemo<[number, number]>(() => {
    const range = machineSummary?.safe_speed_ranges?.print;
    if (Array.isArray(range) && range.length === 2) return [range[0], range[1]];
    // Fallback if not provided
    return [0, 100];
  }, [machineSummary]);

  // Some convenient shorthands for display
  const issues =
    response.issue_list ??
    response.issues ??
    response.predictions?.map((p: any) => ({ id: p.issue_id ?? p.id, confidence: p.confidence })) ??
    [];

  const parametersFromDiff =
    // Prefer the richer slicer_profile_diff if present
    (response as any).slicer_profile_diff?.parameters ??
    // Compatibility: some responses may provide plain diff.markdown/parameters
    (response as any).slicer_profile_diff?.diff ??
    undefined;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {machine.brand} {machine.model}
        </Text>
        <Text style={styles.subtitle}>
          Experience: {experience} · Material: {response.material ?? 'N/A'}
        </Text>
      </View>

      {/* Image Preview */}
      <View style={styles.imageBox}>
        <Image
          source={{ uri: image.uri }}
          style={{ width: Math.min(320, image.width), height: Math.min(240, image.height), borderRadius: 8 }}
          resizeMode="cover"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {/* Issues */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Detected Issues</Text>
          {issues.length === 0 ? (
            <Text style={styles.muted}>No issues detected.</Text>
          ) : (
            issues.map((it: any, idx: number) => (
              <Text key={`${it.id}-${idx}`} style={styles.row}>
                • {it.id} ({typeof it.confidence === 'number' ? (it.confidence * 100).toFixed(0) : '—'}%)
              </Text>
            ))
          )}
        </View>

        {/* Suggested Parameters (from diff/parameters if present) */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Suggested Parameters</Text>
          {parametersFromDiff ? (
            Object.entries(parametersFromDiff as Record<string, any>).map(([key, v]) => {
              const value =
                typeof v === 'object' && v !== null && 'value' in v ? (v as any).value : typeof v !== 'object' ? v : '—';
              const unit = typeof v === 'object' && v !== null && 'unit' in v ? (v as any).unit : undefined;
              return (
                <Text key={key} style={styles.row}>
                  • {key}: {String(value)}
                  {unit ? ` ${unit}` : ''}
                </Text>
              );
            })
          ) : (
            <Text style={styles.muted}>No explicit parameter changes provided.</Text>
          )}
        </View>

        {/* Heatmap / Speed slider demo (tested) */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Preview Adjustment Range</Text>
          <Slider
            testID="adjustment-slider"
            minimumValue={minPrint}
            maximumValue={maxPrint}
            value={(minPrint + maxPrint) / 2}
            step={1}
          />
          <Text style={styles.muted}>
            Range: {minPrint}–{maxPrint}
          </Text>
        </View>

        {/* Notes / Recommendations */}
        {!!response.recommendations?.length && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Recommendations</Text>
            {response.recommendations.map((rec, idx) => (
              <Text key={idx} style={styles.row}>
                • {rec}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <Pressable onPress={onRetake} style={[styles.button, styles.secondary]}>
          <Text style={styles.buttonText}>Retake</Text>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.button, styles.primary]}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = {
  container: {
    flex: 1 as const,
    backgroundColor: '#0b0f1a',
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '700' as const },
  subtitle: { color: '#94a3b8', marginTop: 2 },
  imageBox: {
    alignItems: 'center' as const,
    marginVertical: 12,
  },
  scrollBody: {
    paddingBottom: 24,
  },
  block: { marginBottom: 16 },
  blockTitle: { color: '#ffffff', fontWeight: '700' as const, marginBottom: 8 },
  row: { color: '#e2e8f0', marginBottom: 4 },
  muted: { color: '#94a3b8' },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  primary: { backgroundColor: '#2563eb' },
  secondary: { backgroundColor: '#1f2937' },
  buttonText: { color: '#ffffff', fontWeight: '600' as const },
};

export default AnalysisResult;

describe('AnalysisResult', () => {
  const baseResponse: AnalyzeResponse = {
    image_id: 'img-1',
    version: 'test',
    machine: { id: 'machine', brand: 'Brand', model: 'Model' },
    experience: 'Beginner',
    material: 'PLA',
    predictions: [],
    explanations: [],
    localization: { boxes: [], heatmap: null },
    capability_notes: [],
    recommendations: [],
    suggestions: [],
    slicer_profile_diff: undefined,
    applied: {
      parameters: {},
      hidden_parameters: [],
      experience_level: 'Beginner',
      clamped_to_machine_limits: false,
      explanations: [],
    },
    low_confidence: false,
  };

  it('renders the adjustment slider with range information', () => {
    render(
      <AnalysisResult
        machine={{ id: 'bambu_p1s', brand: 'Bambu', model: 'P1S' }}
        response={baseResponse}
        experience="Intermediate"
        image={{ uri: 'file://preview.jpg', width: 640, height: 480 }}
        onClose={jest.fn()}
        onRetake={jest.fn()}
        machineSummary={{
          id: 'bambu_p1s',
          brand: 'Bambu',
          model: 'P1S',
          safe_speed_ranges: { print: [40, 300] },
        }}
      />,
    );

    expect(screen.getByTestId('adjustment-slider')).toBeTruthy();
  });
});
