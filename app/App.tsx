import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import OnboardingScreen from './src/screens/Onboarding';
import { ResultsScreen } from './src/screens/Results';
import type { OnboardingState } from './src/types';
import { DEFAULT_ONBOARDING, loadOnboardingState } from './src/storage/onboarding';

export default function App() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const saved = await loadOnboardingState();
        setState(saved);
        setShowOnboarding(saved.selectedMachines.length === 0);
      } catch (err) {
        console.warn('Failed to hydrate onboarding state', err);
        setState(DEFAULT_ONBOARDING);
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    };
    hydrate();
  }, []);

  const handleComplete = (payload: OnboardingState) => {
    setState(payload);
    setShowOnboarding(false);
  };

  const handleBack = () => {
    setShowOnboarding(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {loading && <ActivityIndicator />}
        {!loading && showOnboarding && (
          <OnboardingScreen
            initialSelection={state.selectedMachines}
            initialExperience={state.experience}
            onComplete={handleComplete}
          />
        )}
        {!loading && !showOnboarding && (
          <ResultsScreen
            selectedMachines={state.selectedMachines}
            experience={state.experience}
            onBack={handleBack}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
  },
});
