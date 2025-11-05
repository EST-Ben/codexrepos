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
import { loadOnboardingState, saveOnboardingState } from '../storage/onboarding';

// Local canonical default; always ensure materialByMachine exists
const DEFAULT_PROFILE: ProfileState & { materialByMachine: Record<string, string | undefined> } = {
  experience: 'Beginner',
  machines: [],
  material: undefined,
  materialByMachine: {},
};

interface ProfileContextValue {
  profile: ProfileState & { materialByMachine: Record<string, string | undefined> };
  loading: boolean;
  setProfile(profile: ProfileState): Promise<void>;
  setMaterial(machineId: string, material: string | undefined): Promise<void>;
  reset(): Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<ProfileContextValue['profile']>({ ...DEFAULT_PROFILE });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      const stored = await loadOnboardingState();
      const normalized: ProfileContextValue['profile'] = {
        experience: stored?.experience ?? DEFAULT_PROFILE.experience,
        machines: (stored?.selectedMachines ?? []).map<MachineRef>((id) => ({ id, brand: '', model: '' })),
        material: undefined,
        materialByMachine: {}, // always present
      };
      setProfileState(normalized);
      setLoading(false);
    };
    hydrate();
  }, []);

  const persist = useCallback(async (next: ProfileContextValue['profile']) => {
    setProfileState(next);
    // mirror back to onboarding storage (just id list + experience)
    const minimal = {
      selectedMachines: next.machines.map((m) => m.id),
      experience: next.experience,
    };
    await saveOnboardingState(minimal);
  }, []);

  const handleSetProfile = useCallback<ProfileContextValue['setProfile']>(
    async (incoming) => {
      const machines: MachineRef[] = incoming.machines ?? [];
      const allowedIds = new Set(machines.map((m) => m.id));

      // Normalize materialByMachine to {}
      const existingMap = incoming.materialByMachine ?? profile.materialByMachine ?? {};
      const filteredMaterial: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(existingMap)) {
        if (allowedIds.has(key)) filteredMaterial[key] = value;
      }

      const next = {
        experience: incoming.experience,
        machines,
        material: incoming.material ?? profile.material,
        materialByMachine: filteredMaterial,
      };
      await persist(next);
    },
    [persist, profile.material, profile.materialByMachine],
  );

  const setMaterial = useCallback<ProfileContextValue['setMaterial']>(
    async (machineId, material) => {
      const materialByMachine = { ...(profile.materialByMachine ?? {}) };
      if (material) materialByMachine[machineId] = material;
      else delete materialByMachine[machineId];
      await persist({ ...profile, materialByMachine });
    },
    [persist, profile],
  );

  const reset = useCallback<ProfileContextValue['reset']>(async () => {
    await persist({ ...DEFAULT_PROFILE });
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
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
