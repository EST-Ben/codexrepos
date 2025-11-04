/**
 * Onboarding/profile local storage helpers for web + native.
 * Provides:
 *  - loadOnboardingState / saveOnboardingState (used at app start)
 *  - DEFAULT_PROFILE / loadStoredProfile / saveStoredProfile (compat exports used by profile state)
 */

import type { OnboardingState, ProfileState } from '../types';

// Storage keys
const ONBOARDING_KEY = 'codex.onboarding.v1';
const PROFILE_KEY = 'codex.profile.v1';

// A minimal default profile the app can hydrate with
export const DEFAULT_PROFILE: ProfileState = {
  experience: 'Intermediate',
  machines: [],
  material: undefined,
  materialByMachine: {}
};

// ---- Onboarding state ----
export async function loadOnboardingState(): Promise<OnboardingState | null> {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic shape guard
    if (!parsed || !Array.isArray(parsed.selectedMachines) || !parsed.experience) {
      return null;
    }
    return parsed as OnboardingState;
  } catch {
    return null;
  }
}

export async function saveOnboardingState(state: OnboardingState | null): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!state) {
      localStorage.removeItem(ONBOARDING_KEY);
      return;
    }
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ---- Profile state (compat with existing imports) ----
export async function loadStoredProfile(): Promise<ProfileState> {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PROFILE;
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    // Shallow sanity checks
    if (!parsed || !parsed.experience || !Array.isArray(parsed.machines)) {
      return DEFAULT_PROFILE;
    }
    return parsed as ProfileState;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveStoredProfile(profile: ProfileState): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}
