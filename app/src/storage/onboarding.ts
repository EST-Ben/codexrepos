// app/src/storage/onboarding.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileState, ExperienceLevel } from '../types';

const STORAGE_KEY = '@profile:v1';

export const DEFAULT_PROFILE: ProfileState & {
  materialByMachine: Record<string, string | undefined>;
} = {
  experience: 'Intermediate' as ExperienceLevel,
  machines: [],
  material: undefined,
  materialByMachine: {}, // required by state/profile.tsx shape
};

/** Persist the full profile */
export async function saveStoredProfile(
  profile: ProfileState & { materialByMachine: Record<string, string | undefined> },
): Promise<void> {
  try {
    const json = JSON.stringify(profile);
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch (err) {
    // Non-fatal: ignore write errors to avoid blocking UI
    console.warn('[saveStoredProfile] failed:', err);
  }
}

/** Load and normalize a stored profile; falls back to DEFAULT_PROFILE */
export async function loadStoredProfile(): Promise<
  ProfileState & { materialByMachine: Record<string, string | undefined> }
> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };

    const parsed = JSON.parse(raw) as Partial<ProfileState> & {
      materialByMachine?: Record<string, string | undefined>;
    };

    // Defensive normalization / migrations
    return {
      experience: parsed.experience ?? DEFAULT_PROFILE.experience,
      machines: parsed.machines ?? DEFAULT_PROFILE.machines,
      material: parsed.material ?? DEFAULT_PROFILE.material,
      materialByMachine: parsed.materialByMachine ?? {},
    };
  } catch (err) {
    console.warn('[loadStoredProfile] failed, using defaults:', err);
    return { ...DEFAULT_PROFILE };
  }
}
