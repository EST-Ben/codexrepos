import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadOnboardingState, saveOnboardingState, ONBOARDING_STORAGE_KEY } from '../storage/onboarding';
import { deriveParameterRanges, filterParametersForExperience } from '../state/onboarding';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

describe('onboarding storage helpers', () => {
  it('persists onboarding state to AsyncStorage', async () => {
    const state = { selectedMachines: ['bambu_p1p'], experience: 'Intermediate' as const };
    await saveOnboardingState(state);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify(state),
    );
  });

  it('hydrates onboarding state with defaults when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await loadOnboardingState();
    expect(result.selectedMachines).toEqual([]);
    expect(result.experience).toBe('Beginner');
  });
});

describe('experience filters', () => {
  const parameters = {
    nozzle_temp: 210,
    bed_temp: 60,
    print_speed: 120,
    travel_speed: 150,
    accel: 4000,
    retraction_distance: 0.8,
  };

  it('limits beginner parameters to core controls', () => {
    const result = filterParametersForExperience(parameters, 'Beginner');
    expect(Object.keys(result)).toEqual(['nozzle_temp', 'bed_temp', 'print_speed']);
  });

  it('widens ranges for advanced users', () => {
    const beginnerRanges = deriveParameterRanges(parameters, 'Beginner');
    const advancedRanges = deriveParameterRanges(parameters, 'Advanced');
    expect(advancedRanges.nozzle_temp.max - advancedRanges.nozzle_temp.min).toBeGreaterThan(
      beginnerRanges.nozzle_temp.max - beginnerRanges.nozzle_temp.min,
    );
  });
});
