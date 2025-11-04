import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  ExperienceLevel,
  MachineRef,
  OnboardingState,
} from '../types';
import {
  DEFAULT_ONBOARDING,
  DEFAULT_PROFILE,
  loadOnboardingState,
  loadStoredProfile,
  saveOnboardingState,
  saveStoredProfile,
} from '../storage/onboarding';

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const FALLBACK_STATE: OnboardingState = {
  selectedMachines: [],
  experience: 'Intermediate',
};

function ensureStateShape(state: OnboardingState | null | undefined): OnboardingState {
  if (!state) return { ...FALLBACK_STATE };
  return {
    selectedMachines: Array.isArray(state.selectedMachines)
      ? [...state.selectedMachines]
      : [...FALLBACK_STATE.selectedMachines],
    experience: state.experience ?? FALLBACK_STATE.experience,
  };
}

async function persistState(
  nextState: OnboardingState,
  machines: MachineRef[],
): Promise<void> {
  const nextProfile = {
    ...DEFAULT_PROFILE,
    experience: nextState.experience,
    machines: machines.map((machine) => ({ ...machine })),
    material: DEFAULT_PROFILE.material,
    materialByMachine: {
      ...(DEFAULT_PROFILE.materialByMachine ?? {}),
    },
  };

  await Promise.all([
    saveOnboardingState(nextState),
    saveStoredProfile(nextProfile),
  ]);
}

const OnboardingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING);
  const [machines, setMachines] = useState<MachineRef[]>(DEFAULT_PROFILE.machines ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [loadedState, storedProfile] = await Promise.all([
          loadOnboardingState(),
          loadStoredProfile(),
        ]);

        if (!mounted) return;
        setState(ensureStateShape(loadedState));
        setMachines(storedProfile?.machines ?? DEFAULT_PROFILE.machines ?? []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        console.warn('Failed to hydrate onboarding state', err);
        setState({ ...FALLBACK_STATE });
        setMachines(DEFAULT_PROFILE.machines ?? []);
        setError('We could not restore your previous settings. Please review them below.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedMachineObjects = useMemo(
    () => machines.filter((machine) => state.selectedMachines.includes(machine.id)),
    [machines, state.selectedMachines],
  );

  const handleExperiencePress = useCallback(
    (experience: ExperienceLevel) => {
      setState((prev) => {
        if (prev.experience === experience) {
          return prev;
        }
        const next: OnboardingState = {
          ...prev,
          experience,
        };
        void persistState(next, selectedMachineObjects)
          .then(() => setError(null))
          .catch((err) => {
            console.warn('Failed to persist onboarding experience', err);
            setError('Unable to save your experience preference. Please try again.');
          });
        return next;
      });
    },
    [selectedMachineObjects],
  );

  const toggleMachine = useCallback(
    (machine: MachineRef) => {
      setState((prev) => {
        const exists = prev.selectedMachines.includes(machine.id);
        const nextSelected = exists
          ? prev.selectedMachines.filter((id) => id !== machine.id)
          : [...prev.selectedMachines, machine.id];
        const next: OnboardingState = {
          ...prev,
          selectedMachines: nextSelected,
        };
        const nextMachineObjects = machines.filter((item) => nextSelected.includes(item.id));
        void persistState(next, nextMachineObjects)
          .then(() => setError(null))
          .catch((err) => {
            console.warn('Failed to persist onboarding machine selection', err);
            setError('Unable to save your machine selection.');
          });
        return next;
      });
    },
    [machines],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Preparing your onboarding experience…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to Codex</Text>
      <Text style={styles.subtitle}>
        Tell us a little bit about your setup to tailor the recommendations.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience level</Text>
        <View style={styles.chipRow}>
          {EXPERIENCE_OPTIONS.map((option) => {
            const selected = state.experience === option;
            return (
              <Pressable
                key={option}
                onPress={() => handleExperiencePress(option)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected && styles.chipLabelSelected,
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
        {machines.length === 0 ? (
          <Text style={styles.placeholder}>
            No machines saved yet. You can add them later from the settings screen.
          </Text>
        ) : (
          machines.map((machine) => {
            const selected = state.selectedMachines.includes(machine.id);
            return (
              <Pressable
                key={machine.id}
                onPress={() => toggleMachine(machine)}
                style={({ pressed }) => [
                  styles.machineRow,
                  selected && styles.machineRowSelected,
                  pressed && styles.machineRowPressed,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <View>
                  <Text style={styles.machineName}>
                    {machine.brand} {machine.model}
                  </Text>
                  {machine.type ? (
                    <Text style={styles.machineMeta}>{machine.type}</Text>
                  ) : null}
                </View>
                {selected ? <Text style={styles.machineSelected}>Selected</Text> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
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
  error: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    color: '#991B1B',
    fontSize: 14,
  },
});

export default OnboardingScreen;
