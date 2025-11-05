import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useMachineRegistry } from '../hooks/useMachineRegistry';
import type {
  ExperienceLevel,
  MachineRef,
  OnboardingState,
} from '../types';
import {
  DEFAULT_PROFILE,
  loadStoredProfile,
  saveOnboardingState,
  saveStoredProfile,
} from '../storage/onboarding';

interface OnboardingScreenProps {
  initialSelection: string[];
  initialExperience: ExperienceLevel;
  onComplete(state: OnboardingState): void;
}

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

function normalizeProfileMachines(
  machines: MachineRef[] | undefined,
): MachineRef[] {
  if (!machines) {
    return [];
  }
  return machines.map((machine) => ({ ...machine }));
}

export default function OnboardingScreen({
  initialSelection,
  initialExperience,
  onComplete,
}: OnboardingScreenProps) {
  const { machines, loading, error, refresh } = useMachineRegistry();
  const [selected, setSelected] = useState<string[]>(() => [...initialSelection]);
  const [experience, setExperience] = useState<ExperienceLevel>(initialExperience);
  const [hydratedProfileMachines, setHydratedProfileMachines] = useState<MachineRef[]>(
    () => normalizeProfileMachines(DEFAULT_PROFILE.machines),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected([...initialSelection]);
  }, [initialSelection]);

  useEffect(() => {
    setExperience(initialExperience);
  }, [initialExperience]);

  useEffect(() => {
    (async () => {
      const stored = await loadStoredProfile();
      setHydratedProfileMachines(normalizeProfileMachines(stored?.machines));
    })();
  }, []);

  const toggleMachine = useCallback((machineId: string) => {
    setSelected((prev) =>
      prev.includes(machineId)
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId],
    );
  }, []);

  const selectedSummaries = useMemo(
    () => machines.filter((machine) => selected.includes(machine.id)),
    [machines, selected],
  );

  const allKnownMachines = useMemo(
    () =>
      selectedSummaries.length > 0
        ? selectedSummaries
        : hydratedProfileMachines.filter((machine) => selected.includes(machine.id)),
    [hydratedProfileMachines, selected, selectedSummaries],
  );

  const canContinue = selected.length > 0 && !saving;

  const persistSelection = useCallback(
    async (next: OnboardingState, machineRefs: MachineRef[]): Promise<void> => {
      await saveOnboardingState(next);
      const nextProfile = {
        ...DEFAULT_PROFILE,
        experience: next.experience,
        machines: machineRefs,
        materialByMachine: {
          ...(DEFAULT_PROFILE.materialByMachine ?? {}),
        },
      };
      await saveStoredProfile(nextProfile);
    },
    [],
  );

  const handleContinue = useCallback(async () => {
    if (!selected.length || saving) {
      return;
    }
    const next: OnboardingState = {
      selectedMachines: [...selected],
      experience,
    };
    setSaving(true);
    try {
      const machineRefs = allKnownMachines.length
        ? allKnownMachines
        : normalizeProfileMachines(DEFAULT_PROFILE.machines);
      await persistSelection(next, machineRefs);
      onComplete(next);
    } finally {
      setSaving(false);
    }
  }, [allKnownMachines, experience, onComplete, persistSelection, saving, selected]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Welcome to Codex</Text>
        <Text style={styles.subtitle}>
          Select your primary machines and tell us your experience level so we can
          tailor the recommendations.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience level</Text>
        <View style={styles.chipRow}>
          {EXPERIENCE_OPTIONS.map((option) => {
            const selectedOption = experience === option;
            return (
              <Pressable
                key={option}
                onPress={() => setExperience(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedOption }}
                style={({ pressed }) => [
                  styles.chip,
                  selectedOption && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selectedOption && styles.chipLabelSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Machines</Text>
        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryBox}>
            <Text style={styles.retryText}>
              We could not load your machine list. Tap to retry.
            </Text>
          </Pressable>
        ) : machines.length === 0 ? (
          <Text style={styles.placeholder}>No machines available yet.</Text>
        ) : (
          machines.map((machine) => {
            const isSelected = selected.includes(machine.id);
            return (
              <Pressable
                key={machine.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggleMachine(machine.id)}
                style={({ pressed }) => [
                  styles.machineRow,
                  isSelected && styles.machineRowSelected,
                  pressed && styles.machineRowPressed,
                ]}
              >
                <View>
                  <Text style={styles.machineName}>
                    {machine.brand} {machine.model}
                  </Text>
                  {machine.type ? (
                    <Text style={styles.machineMeta}>{machine.type}</Text>
                  ) : null}
                </View>
                {isSelected ? <Text style={styles.machineSelected}>Selected</Text> : null}
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canContinue}
        onPress={handleContinue}
        style={({ pressed }) => [
          styles.primaryButton,
          (!canContinue || pressed) && styles.primaryButtonDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.primaryLabel}>Continue</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
    backgroundColor: '#F9FAFB',
  },
  hero: {
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipLabel: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  placeholder: {
    fontSize: 14,
    color: '#6B7280',
  },
  machineRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  machineRowSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  machineRowPressed: {
    opacity: 0.8,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  machineMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  machineSelected: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  retryBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  retryText: {
    color: '#92400E',
    fontSize: 14,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FACC15',
  },
  primaryButtonDisabled: {
    backgroundColor: '#FCD34D',
    opacity: 0.7,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
});
