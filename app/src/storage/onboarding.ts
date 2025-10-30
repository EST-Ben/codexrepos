import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ExperienceLevel, OnboardingState } from '../types';

export const ONBOARDING_STORAGE_KEY = 'machine-diagnostics:onboarding';

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  selectedMachines: [],
  experience: 'Beginner',
};

export async function loadOnboardingState(): Promise<OnboardingState> {
  const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_ONBOARDING_STATE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      selectedMachines: parsed.selectedMachines ?? [],
      experience: (parsed.experience as ExperienceLevel) ?? 'Beginner',
    };
  } catch (err) {
    console.warn('Failed to parse onboarding state', err);
    return { ...DEFAULT_ONBOARDING_STATE };
  }
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}
