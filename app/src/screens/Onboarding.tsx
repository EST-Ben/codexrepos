import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ExperienceLevel, OnboardingState } from '../types';
import { saveOnboardingState } from '../storage/onboarding';

type Props = {
  initialSelection?: string[];
  initialExperience?: ExperienceLevel;
  onComplete(state: OnboardingState): void;
};

// Minimal inline options; replace with real registry if you like
const MACHINE_CHOICES = [
  { id: 'bambu_p1s', label: 'Bambu Lab P1S' },
  { id: 'ender_3', label: 'Creality Ender-3' },
  { id: 'mk4', label: 'Prusa MK4' },
];

const EXPERIENCES: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

const OnboardingScreen: React.FC<Props> = ({
  initialSelection = [],
  initialExperience = 'Beginner',
  onComplete,
}) => {
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [experience, setExperience] = useState<ExperienceLevel>(initialExperience);

  const toggleMachine = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const canContinue = useMemo(() => selected.length > 0, [selected]);

  const handleContinue = useCallback(async () => {
    const payload: OnboardingState = {
      selectedMachines: selected,
      experience,
    };
    await saveOnboardingState(payload);
    onComplete(payload);
  }, [experience, onComplete, selected]);

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Choose your machine(s)</Text>
      {MACHINE_CHOICES.map((m) => {
        const active = selected.includes(m.id);
        return (
          <Pressable
            key={m.id}
            onPress={() => toggleMachine(m.id)}
            style={[styles.row, active && styles.rowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.rowText}>{m.label}</Text>
            <Text style={styles.rowTick}>{active ? '✓' : ''}</Text>
          </Pressable>
        );
      })}

      <Text style={[styles.heading, { marginTop: 24 }]}>Experience level</Text>
      <View style={styles.chips}>
        {EXPERIENCES.map((lvl) => {
          const active = lvl === experience;
          return (
            <Pressable
              key={lvl}
              onPress={() => setExperience(lvl)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{lvl}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleContinue}
        disabled={!canContinue}
        style={[styles.cta, !canContinue && styles.ctaDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>Continue</Text>
      </Pressable>
    </View>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#0f172a' },
  heading: { color: '#e2e8f0', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    marginBottom: 8,
  },
  rowActive: { backgroundColor: '#334155' },
  rowText: { color: '#e5e7eb' },
  rowTick: { color: '#a7f3d0', fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1f2937',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#cbd5e1' },
  chipTextActive: { color: 'white', fontWeight: '700' },
  cta: {
    marginTop: 24,
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  ctaDisabled: { backgroundColor: '#64748b' },
  ctaText: { color: 'white', fontWeight: '700' },
});
