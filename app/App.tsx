import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import AnalyzeFromPhoto from "./src/components/AnalyzeFromPhoto"; // adjust the path if your file lives elsewhere

import { OnboardingScreen } from './src/screens/Onboarding';
import { ResultsScreen } from './src/screens/Results';
import type { OnboardingState } from './src/types';
import { loadOnboardingState } from './src/storage/onboarding';

export default function App(): JSX.Element {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      const saved = await loadOnboardingState();
      setState(saved);
      setShowOnboarding(saved.selectedMachines.length === 0);
      setLoading(false);
    };
    hydrate();
  }, []);

  const handleComplete = (payload: OnboardingState) => {
    setState(payload);
    setShowOnboarding(false);
  };

  const handleReset = () => {
    setShowOnboarding(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {loading && <ActivityIndicator />}
        {!loading && showOnboarding && state && (
          <OnboardingScreen
            initialSelection={state.selectedMachines}
            initialExperience={state.experience}
            onComplete={handleComplete}
          />
        )}
        {!loading && !showOnboarding && state && (
          <ResultsScreen
            selectedMachines={state.selectedMachines}
            experience={state.experience}
            onReset={handleReset}
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
