// src/storage/onboarding.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingState } from '../types';

export const ONBOARDING_STORAGE_KEY = 'onboarding:v1';

export const DEFAULT_ONBOARDING: OnboardingState = {
  selectedMachines: [],
  experience: 'Beginner',
};

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  // Persist a minimal, validated shape
  const payload: OnboardingState = {
    selectedMachines: Array.isArray(state.selectedMachines) ? state.selectedMachines : [],
    experience: state.experience ?? 'Beginner',
  };
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadOnboardingState(): Promise<OnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ONBOARDING;
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingState> | null;

    const selectedMachines = Array.isArray(parsed?.selectedMachines) ? parsed!.selectedMachines : [];
    const experience = (parsed?.experience ?? 'Beginner') as OnboardingState['experience'];

    return { selectedMachines, experience };
  } catch {
    // Corrupt JSON or any other error → fall back to defaults
    return DEFAULT_ONBOARDING;
  }
}
