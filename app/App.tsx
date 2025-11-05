import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import './src/debug/networkInterceptor';
import { DebuggerHUD } from './src/debug/DebuggerHUD';
import { ErrorBoundary } from './src/debug/ErrorBoundary';

import OnboardingScreen from './src/screens/Onboarding';
import ResultsScreen from './src/screens/Results';

import type { OnboardingState } from './src/types';
import { loadOnboardingState } from './src/storage/onboarding';

export default function App() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      const saved = await loadOnboardingState();

      if (!saved) {
        // First run or nothing persisted yet
        const fallback: OnboardingState = { selectedMachines: [], experience: 'Beginner' };
        setState(fallback);
        setShowOnboarding(true);
        setLoading(false);
        return;
      }

      setState(saved);
      setShowOnboarding((saved.selectedMachines ?? []).length === 0);
      setLoading(false);
    };

    hydrate();
  }, []);

  const handleComplete = (payload: OnboardingState) => {
    setState(payload);
    setShowOnboarding(false);
  };

  const handleBackToOnboarding = () => {
    setShowOnboarding(true);
  };

  return (
    <ErrorBoundary>
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
              onBack={handleBackToOnboarding}
            />
          )}
        </View>
        <DebuggerHUD />
      </SafeAreaView>
    </ErrorBoundary>
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
