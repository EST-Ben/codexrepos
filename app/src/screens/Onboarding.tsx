import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ExperienceLevel, OnboardingState } from '../types';
import { saveOnboardingState } from '../storage/onboarding';
import { useMachineRegistry } from '../hooks/useMachineRegistry';

type Props = {
  initialSelection?: string[];
  initialExperience?: ExperienceLevel;
  onComplete(state: OnboardingState): void;
};

const EXPERIENCES: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

const OnboardingScreen: React.FC<Props> = ({
  initialSelection = [],
  initialExperience = 'Beginner',
  onComplete,
}) => {
  const { ids, byId, loading, error, refresh } = useMachineRegistry();
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [experience, setExperience] = useState<ExperienceLevel>(initialExperience);

  const machineChoices = useMemo(() => {
    return ids
      .map((id) => byId(id))
      .filter((machine): machine is NonNullable<ReturnType<typeof byId>> => !!machine)
      .map((machine) => {
        const brand = machine.brand?.trim() ?? '';
        const model = machine.model?.trim() ?? '';
        const label = [brand, model].filter(Boolean).join(' ');
        return {
          id: machine.id,
          label: label.length > 0 ? label : machine.id,
        };
      });
  }, [byId, ids]);

  useEffect(() => {
    if (!machineChoices.length) {
      return;
    }
    setSelected((prev) => prev.filter((id) => machineChoices.some((choice) => choice.id === id)));
  }, [machineChoices]);

  const toggleMachine = useCallback(
    (id: string) => {
      if (!byId(id)) return;
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [byId]
  );

  const hasChoices = machineChoices.length > 0;
  const canContinue = useMemo(() => selected.length > 0 && hasChoices && !loading, [hasChoices, loading, selected]);

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
      {loading && <Text style={styles.statusText}>Loading machines…</Text>}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Unable to load machines: {error.message ?? 'Unknown error'}
          </Text>
          <Pressable onPress={() => { void refresh(); }} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {!loading && !error && machineChoices.length === 0 && (
        <Text style={styles.statusText}>No machines available.</Text>
      )}
      {!loading && !error && machineChoices.map((machine) => {
        const active = selected.includes(machine.id);
        return (
          <Pressable
            key={machine.id}
            onPress={() => toggleMachine(machine.id)}
            style={[styles.row, active && styles.rowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.rowText}>{machine.label}</Text>
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
  statusText: { color: '#94a3b8', marginBottom: 8 },
  errorBox: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ef4444',
    backgroundColor: '#450a0a',
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#fecaca' },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#b91c1c',
    marginTop: 4,
  },
  retryText: { color: '#fee2e2', fontWeight: '600' },
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
