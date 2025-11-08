import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_PRIVACY_SETTINGS, loadPrivacySettings, savePrivacySettings, type PrivacySettings } from '../storage/settings';

interface PrivacyContextValue {
  settings: PrivacySettings;
  loading: boolean;
  update(partial: Partial<PrivacySettings>): Promise<void>;
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PrivacySettings>({ ...DEFAULT_PRIVACY_SETTINGS });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      const stored = await loadPrivacySettings();
      setSettings(stored);
      setLoading(false);
    };
    void hydrate();
  }, []);

  const update = useCallback(async (partial: Partial<PrivacySettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await savePrivacySettings(next);
  }, [settings]);

  const value = useMemo<PrivacyContextValue>(() => ({ settings, loading, update }), [settings, loading, update]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
};

export function usePrivacySettings(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error('usePrivacySettings must be used within a PrivacyProvider');
  }
  return ctx;
}
