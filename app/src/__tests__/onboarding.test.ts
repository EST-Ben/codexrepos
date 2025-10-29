import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PROFILE,
  PROFILE_STORAGE_KEY,
  loadStoredProfile,
  saveStoredProfile,
} from '../storage/onboarding';

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

describe('profile storage helpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

  it('persists profile state with machine references', async () => {
    const profile = {
      experience: 'Intermediate' as const,
      material: 'PETG',
      machines: [
        { id: 'bambu_p1s', brand: 'Bambu Lab', model: 'P1S' },
        { id: 'prusa_mk4', brand: 'Prusa', model: 'MK4' },
      ],
      materialByMachine: { bambu_p1s: 'PLA' },
    };
    await saveStoredProfile(profile);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        experience: 'Intermediate',
        machines: profile.machines,
        material: 'PETG',
        materialByMachine: { bambu_p1s: 'PLA' },
      }),
    );
  });

  it('hydrates with defaults when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await loadStoredProfile();
    expect(result).toEqual(DEFAULT_PROFILE);
  });

  it('drops malformed machine entries when loading', async () => {
    const malformed = {
      experience: 'Advanced',
      machines: [{ id: 'missing_brand' }],
      material: 'ABS',
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(malformed));
    const result = await loadStoredProfile();
    expect(result.machines).toEqual([]);
    expect(result.experience).toBe('Advanced');
    expect(result.material).toBe('ABS');
  });
});
