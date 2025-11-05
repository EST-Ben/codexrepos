import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { MachineRef, ProfileState } from '../types';
import { DEFAULT_PROFILE, loadStoredProfile, saveStoredProfile } from '../storage/onboarding';

type ProfileContextProfile = ProfileState & {
  materialByMachine: Record<string, string | undefined>;
};

interface ProfileContextValue {
  profile: ProfileContextProfile;
  loading: boolean;
  setProfile(profile: ProfileState): Promise<void>;
  setMaterial(machineId: string, material: string | undefined): Promise<void>;
  reset(): Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function ensureProfile(input: ProfileState | null | undefined): ProfileContextProfile {
  const machines: MachineRef[] = Array.isArray(input?.machines)
    ? [...(input?.machines as MachineRef[])]
    : [...(DEFAULT_PROFILE.machines ?? [])];

  return {
    experience: input?.experience ?? DEFAULT_PROFILE.experience,
    machines,
    material: input?.material ?? DEFAULT_PROFILE.material,
    materialByMachine: {
      ...(DEFAULT_PROFILE.materialByMachine ?? {}),
      ...(input?.materialByMachine ?? {}),
    },
  };
}

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<ProfileContextProfile>(() =>
    ensureProfile(DEFAULT_PROFILE),
  );
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      const stored = await loadStoredProfile();
      setProfileState(ensureProfile(stored));
      setLoading(false);
    };
    hydrate();
  }, []);

  const persist = useCallback(async (next: ProfileState) => {
    const normalized = ensureProfile(next);
    setProfileState(normalized);
    await saveStoredProfile(normalized);
  }, []);

  const handleSetProfile = useCallback<ProfileContextValue['setProfile']>(
    async (incoming) => {
      const machines: MachineRef[] = incoming.machines ?? [];
      const allowedIds = new Set(machines.map((machine) => machine.id));
      const existingMap = incoming.materialByMachine ?? profile.materialByMachine ?? {};
      const filteredMaterial: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(existingMap)) {
        if (allowedIds.has(key)) {
          filteredMaterial[key] = value;
        }
      }
      const normalized = {
        experience: incoming.experience,
        machines,
        material: incoming.material ?? profile.material,
        materialByMachine: filteredMaterial,
      };
      await persist(normalized);
    },
    [persist, profile.material, profile.materialByMachine],
  );

  const setMaterial = useCallback<ProfileContextValue['setMaterial']>(
    async (machineId, material) => {
      const materialByMachine = { ...(profile.materialByMachine ?? {}) };
      if (material) {
        materialByMachine[machineId] = material;
      } else {
        delete materialByMachine[machineId];
      }
      const next = { ...profile, materialByMachine };
      await persist(next);
    },
    [persist, profile],
  );

  const reset = useCallback<ProfileContextValue['reset']>(async () => {
    await persist(DEFAULT_PROFILE);
  }, [persist]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      setProfile: handleSetProfile,
      setMaterial,
      reset,
    }),
    [handleSetProfile, loading, profile, reset, setMaterial],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}
