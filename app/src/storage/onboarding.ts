import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MachineRef, ProfileState } from '../types';

export const PROFILE_STORAGE_KEY = 'machine-diagnostics:profile';

export interface StoredProfile extends ProfileState {
  materialByMachine: Record<string, string | undefined>;
}

export const DEFAULT_PROFILE: StoredProfile = {
  experience: 'Beginner',
  machines: [],
  material: 'PLA',
  materialByMachine: {},
};

function normalizeProfile(data: Partial<ProfileState> | null | undefined): StoredProfile {
  if (!data) {
    return { ...DEFAULT_PROFILE };
  }
  const machines: MachineRef[] = Array.isArray(data.machines)
    ? data.machines.filter((item): item is MachineRef =>
        !!item && typeof item.id === 'string' && typeof item.brand === 'string' && typeof item.model === 'string',
      )
    : [];
  const materialByMachine =
    typeof data.materialByMachine === 'object' && data.materialByMachine
      ? Object.fromEntries(
          Object.entries(data.materialByMachine).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]),
        )
      : {};
  return {
    experience: (data.experience as StoredProfile['experience']) ?? DEFAULT_PROFILE.experience,
    machines,
    material: typeof data.material === 'string' ? data.material : DEFAULT_PROFILE.material,
    materialByMachine,
  };
}

export async function loadStoredProfile(): Promise<StoredProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PROFILE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileState>;
    return normalizeProfile(parsed);
  } catch (err) {
    console.warn('Failed to parse stored profile', err);
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveStoredProfile(profile: ProfileState): Promise<void> {
  const normalized = normalizeProfile(profile);
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
}
