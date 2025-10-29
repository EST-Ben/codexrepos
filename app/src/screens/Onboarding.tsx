import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ExperienceLevel, MachineRef, ProfileState } from '../types';
import { filterMachines, useMachineRegistry } from '../hooks/useMachineRegistry';

interface OnboardingProps {
  initialProfile: ProfileState;
  onComplete(state: ProfileState): Promise<void>;
}

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

const MATERIAL_PLACEHOLDER = 'PLA';

export const OnboardingScreen: React.FC<OnboardingProps> = ({ initialProfile, onComplete }) => {
  const { machines, loading, error, refresh } = useMachineRegistry();
  const [step, setStep] = useState<number>(0);
  const [selected, setSelected] = useState<string[]>(initialProfile.machines.map((item) => item.id));
  const [experience, setExperience] = useState<ExperienceLevel>(initialProfile.experience);
  const [query, setQuery] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [material, setMaterial] = useState<string>(initialProfile.material ?? MATERIAL_PLACEHOLDER);

  useEffect(() => {
    setSelected(initialProfile.machines.map((item) => item.id));
    setExperience(initialProfile.experience);
    setMaterial(initialProfile.material ?? MATERIAL_PLACEHOLDER);
  }, [initialProfile]);

  const filtered = useMemo(() => filterMachines(machines, query), [machines, query]);

  const toggleMachine = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((machine) => machine !== id) : [...prev, id],
    );
  };

  const handleNext = async () => {
    if (step < 2) {
      setStep((prev) => prev + 1);
      return;
    }
    setSaving(true);
    const machineLookup = new Map(machines.map((item) => [item.id, item]));
    const refs: MachineRef[] = selected.map((id) => {
      const summary = machineLookup.get(id);
      return {
        id,
        brand: summary?.brand ?? 'Unknown',
        model: summary?.model ?? id,
      };
    });
    const payload: ProfileState = {
      experience,
      machines: refs,
      material: material.trim() || undefined,
    };
    try {
      await onComplete(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {step === 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to the diagnostics assistant</Text>
          <Text style={styles.paragraph}>
            Choose the machines you own so we can tailor recommendations and export settings to
            your slicer or CAM tool. You can adjust everything later in settings.
          </Text>
        </View>
      )}

      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.title}>Pick your machines</Text>
          <TextInput
            accessibilityLabel="Search machines"
            placeholder="Search by brand, model, or alias"
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          {loading && <ActivityIndicator />}
          {error && (
            <Pressable onPress={refresh} style={styles.errorBox}>
              <Text style={styles.errorText}>Failed to load machines. Tap to retry.</Text>
            </Pressable>
          )}
          {!loading && !error && (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleMachine(item.id)}
                    style={[styles.machineRow, isSelected && styles.machineRowSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={styles.machineTitle}>
                      {item.brand ? `${item.brand} ${item.model ?? ''}`.trim() : item.model ?? item.id}
                    </Text>
                    <Text style={styles.machineSubtitle}>{item.id}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={!loading ? <Text style={styles.paragraph}>No machines found.</Text> : null}
            />
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.title}>Choose your experience level</Text>
          <Text style={styles.paragraph}>
            Your experience determines how many controls we expose and how wide the suggested range
            of adjustments will be.
          </Text>
          <View style={styles.experienceRow}>
            {EXPERIENCE_OPTIONS.map((option) => {
              const active = experience === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setExperience(option)}
                  style={[styles.experienceButton, active && styles.experienceButtonActive]}
                >
                  <Text style={[styles.experienceLabel, active && styles.experienceLabelActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.paragraph}>Machines selected: {selected.length || 'None yet'}.</Text>
            <Text style={styles.paragraph}>Experience: {experience}</Text>
            <Text style={styles.paragraph}>Preferred material: {material || 'Not set'}</Text>
            <TextInput
              accessibilityLabel="Preferred material"
              placeholder="Preferred material (PLA, PETG, ABS…)"
              value={material}
              onChangeText={setMaterial}
              style={styles.input}
            />
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable onPress={() => setStep((prev) => Math.max(prev - 1, 0))} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Back</Text>
          </Pressable>
        )}
        <Pressable
          disabled={saving || (step === 1 && selected.length === 0)}
          onPress={handleNext}
          style={[styles.primaryButton, (saving || (step === 1 && selected.length === 0)) && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryLabel}>
            {step < 2 ? 'Next' : saving ? 'Saving…' : 'Finish onboarding'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101418',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#1c2229',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f8fafc',
  },
  paragraph: {
    color: '#cbd5f5',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#0f1720',
    padding: 12,
    borderRadius: 8,
    color: '#f1f5f9',
    borderColor: '#334155',
    borderWidth: 1,
  },
  list: {
    flex: 1,
  },
  machineRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#233040',
  },
  machineRowSelected: {
    backgroundColor: '#243447',
  },
  machineTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },
  machineSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#38bdf8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    flex: 1,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  experienceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  experienceButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  experienceButtonActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  experienceLabel: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  experienceLabelActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  summaryBox: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  summaryTitle: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fecaca',
  },
});
