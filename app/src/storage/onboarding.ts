// app/src/storage/onboarding.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingState, ProfileState, ExperienceLevel } from '../types';

const ONBOARDING_KEY = 'onboarding_state_v1';

export const DEFAULT_ONBOARDING: OnboardingState = {
  selectedMachines: [],                // <-- important: always present
  experience: 'Intermediate',
};

const hasWindow =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

async function storageGet(key: string): Promise<string | null> {
  try {
    if (hasWindow) return window.localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (hasWindow) { window.localStorage.setItem(key, value); return; }
  await AsyncStorage.setItem(key, value);
}

async function storageRemove(key: string): Promise<void> {
  if (hasWindow) { window.localStorage.removeItem(key); return; }
  await AsyncStorage.removeItem(key);
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function loadOnboardingState(): Promise<OnboardingState> {
  const parsed = safeParse<OnboardingState>(await storageGet(ONBOARDING_KEY));
  // Always return an object with selectedMachines
  return { ...DEFAULT_ONBOARDING, ...(parsed ?? {}) };
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await storageSet(ONBOARDING_KEY, JSON.stringify(state));
}

export async function clearOnboardingState(): Promise<void> {
  await storageRemove(ONBOARDING_KEY);
}

/* Back-compat shims */
export const DEFAULT_PROFILE: ProfileState = {
  experience: ('Intermediate' as ExperienceLevel),
  machines: [],
  material: undefined,
  materialByMachine: {},
};

export const loadStoredProfile = (async () => DEFAULT_PROFILE) as unknown as () => Promise<ProfileState | null>;
export const saveStoredProfile = (async (_state: ProfileState) => {}) as unknown as (state: ProfileState) => Promise<void>;

export default {
  loadOnboardingState,
  saveOnboardingState,
  clearOnboardingState,
  DEFAULT_ONBOARDING,
  DEFAULT_PROFILE,
  loadStoredProfile,
  saveStoredProfile,
};
