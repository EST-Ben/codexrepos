import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrivacySettings {
  storeImagesLocallyOnly: boolean;
  telemetryEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = 'machine-diagnostics:privacy';

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  storeImagesLocallyOnly: true,
  telemetryEnabled: false,
};

function normalizeSettings(raw: unknown): PrivacySettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
  const data = raw as Partial<PrivacySettings>;
  return {
    storeImagesLocallyOnly:
      typeof data.storeImagesLocallyOnly === 'boolean' ? data.storeImagesLocallyOnly : DEFAULT_PRIVACY_SETTINGS.storeImagesLocallyOnly,
    telemetryEnabled:
      typeof data.telemetryEnabled === 'boolean' ? data.telemetryEnabled : DEFAULT_PRIVACY_SETTINGS.telemetryEnabled,
  };
}

export async function loadPrivacySettings(): Promise<PrivacySettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettings(parsed);
  } catch (err) {
    console.warn('Failed to parse privacy settings', err);
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
}

export async function savePrivacySettings(settings: PrivacySettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
