import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OnboardingScreen } from './src/screens/Onboarding';
import { PrinterTabs } from './src/screens/PrinterTabs';
import { AnalysisResult } from './src/screens/AnalysisResult';
import { HistoryScreen } from './src/screens/History';
import type {
  AnalyzeResponse,
  AnalysisHistoryRecord,
  MachineRef,
  MachineSummary,
  ProfileState,
} from './src/types';
import { ProfileProvider, useProfile } from './src/state/profile';
import { useAnalysisHistory } from './src/hooks/useAnalysisHistory';
import { PrivacyProvider } from './src/state/privacy';

const queryClient = new QueryClient();

interface AnalysisViewState {
  machine: MachineRef;
  response: AnalyzeResponse;
  summary?: MachineSummary;
  material?: string;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});

const RootContent: React.FC = () => {
  const { profile, loading, setProfile, setMaterial } = useProfile();
  const { history: historyMap, record: recordHistory } = useAnalysisHistory();
  const [view, setView] = useState<'onboarding' | 'tabs' | 'analysis' | 'history'>('tabs');
  const [analysis, setAnalysis] = useState<AnalysisViewState | null>(null);
  const [historyMachineId, setHistoryMachineId] = useState<string | null>(null);

  const historyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [machineId, entries] of Object.entries(historyMap)) {
      counts[machineId] = entries.length;
    }
    return counts;
  }, [historyMap]);

  useEffect(() => {
    if (!loading && profile.machines.length === 0) {
      setView('onboarding');
    }
  }, [loading, profile.machines.length]);

  const handleOnboardingComplete = async (payload: ProfileState) => {
    await setProfile(payload);
    setAnalysis(null);
    setView('tabs');
  };

  const handleShowAnalysis = (payload: AnalysisViewState) => {
    setAnalysis(payload);
    setView('analysis');
  };

  const handleCloseAnalysis = () => {
    setAnalysis(null);
    setView('tabs');
  };

  const handleRecordHistory = async (entry: AnalysisHistoryRecord) => {
    await recordHistory(entry);
  };

  const handleOpenHistory = (machine?: MachineRef) => {
    setHistoryMachineId(machine?.id ?? null);
    setView('history');
  };

  const handleHistorySelect = (entry: AnalysisHistoryRecord) => {
    if (!entry.response) {
      Alert.alert('Details unavailable', 'This history item does not include a saved response.');
      return;
    }
    const machine =
      profile.machines.find((item) => item.id === entry.machineId) ??
      entry.machine ??
      profile.machines[0];
    if (!machine) {
      Alert.alert('Machine not found', 'The machine for this analysis is no longer in your profile.');
      return;
    }
    setAnalysis({
      machine,
      response: entry.response,
      summary: entry.summary,
      material:
        entry.material ??
        profile.materialByMachine?.[machine.id] ??
        profile.material,
    });
    setView('analysis');
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  if (view === 'onboarding' || profile.machines.length === 0) {
    return (
      <OnboardingScreen
        initialProfile={profile}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  if (view === 'analysis' && analysis) {
    return (
      <AnalysisResult
        machine={analysis.machine}
        response={analysis.response}
        experience={profile.experience}
        material={analysis.material ?? profile.material}
        machineSummary={analysis.summary}
        onClose={handleCloseAnalysis}
        onRetake={handleCloseAnalysis}
      />
    );
  }

  if (view === 'history') {
    return (
      <HistoryScreen
        machines={profile.machines}
        history={historyMap}
        initialMachineId={historyMachineId}
        onClose={() => setView('tabs')}
        onSelect={handleHistorySelect}
      />
    );
  }

  return (
    <PrinterTabs
      profile={profile}
      onEditProfile={() => setView('onboarding')}
      onShowAnalysis={handleShowAnalysis}
      onUpdateMaterial={setMaterial}
      onOpenHistory={handleOpenHistory}
      onRecordHistory={handleRecordHistory}
      historyCounts={historyCounts}
    />
  );
};

const AppShell: React.FC = () => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" />
    <View style={styles.container}>
      <RootContent />
    </View>
  </SafeAreaView>
);

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <ProfileProvider>
          <AppShell />
        </ProfileProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  );
}
