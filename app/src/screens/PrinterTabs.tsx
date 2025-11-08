import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View, Text, Image } from 'react-native';
import Constants from 'expo-constants';
import CameraButton, { type PreparedImage } from '../components/CameraButton';
import WebFilePicker, { type PickedImage } from '../components/WebFilePicker';
import { useMachineRegistry, type MachineId, type Machine } from '../hooks/useMachineRegistry';
import { useAnalyze } from '../hooks/useAnalyze';
import type { AnalyzeRequestMeta } from '../types';

type ExpoExtra = { apiBaseUrl?: string };

export default function PrinterTabs() {
  const { ids, byId, defaultId, loading, error: registryError, refresh } = useMachineRegistry();
  const [selectedId, setSelectedId] = useState<MachineId | null>(defaultId);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File;
  } | null>(null);
  const { analyzeImage, status, error: analyzeError, data, progress } = useAnalyze();

  const apiBase =
    (Constants?.expoConfig?.extra as ExpoExtra | undefined)?.apiBaseUrl ??
    'http://localhost:8000';

  useEffect(() => {
    if (!selectedId && defaultId) {
      setSelectedId(defaultId);
      return;
    }
    if (selectedId && !ids.includes(selectedId)) {
      setSelectedId(ids[0] ?? null);
    }
  }, [defaultId, ids, selectedId]);

  const selectedMachine: Machine | undefined = useMemo(
    () => (selectedId ? byId(selectedId) : undefined),
    [byId, selectedId]
  );

  const handleSelectMachine = useCallback((id: MachineId) => {
    setSelectedId(id);
    setPendingImage(null);
  }, []);

  const pushPreview = useCallback((uri: string) => {
    setPreviews((prev) => {
      const filtered = prev.filter((existing) => existing !== uri);
      return [uri, ...filtered].slice(0, 6);
    });
  }, []);

  const submitImage = useCallback(
    async (file: { uri: string; name: string; type: string; file?: File }) => {
      if (!selectedMachine) {
        Alert.alert('Select a machine first', 'Choose a machine before uploading a photo.');
        return false;
      }

      const meta: AnalyzeRequestMeta = {
        machine_id: selectedMachine.id,
        experience: 'Intermediate',
        material: undefined,
        app_version: 'printer-tabs',
      };

      try {
        await analyzeImage(file, meta);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert('Upload failed', message);
        return false;
      }
    },
    [analyzeImage, selectedMachine]
  );

  const handleImageReady = useCallback(
    (image: PreparedImage) => {
      pushPreview(image.uri);

      const maybeFile =
        typeof File !== 'undefined' && image.blob instanceof File ? (image.blob as File) : undefined;

      void submitImage({
        uri: image.uri,
        name: image.name,
        type: image.type,
        file: maybeFile,
      });
    },
    [pushPreview, submitImage]
  );

  const handleWebPick = useCallback(
    (file: PickedImage) => {
      if (!selectedMachine) {
        Alert.alert('Select a machine first', 'Choose a machine before uploading a photo.');
        return;
      }

      pushPreview(file.uri);
      setPendingImage(file);
    },
    [pushPreview, selectedMachine]
  );

  const handleAnalyze = useCallback(async () => {
    if (!pendingImage) return;
    const success = await submitImage(pendingImage);
    if (success) {
      setPendingImage(null);
    }
  }, [pendingImage, submitImage]);

  const analysisStatusLabel = useMemo(() => {
    switch (status) {
      case 'uploading':
        return 'Uploading photo…';
      case 'success':
        return 'Analysis complete';
      case 'error':
        return 'Analysis failed';
      default:
        return 'Idle';
    }
  }, [status]);

  const machineChoices = useMemo<Array<{ id: MachineId; label: string }>>(() => {
    return ids
      .map((id) => byId(id))
      .filter((machine): machine is Machine => Boolean(machine))
      .map((machine) => ({
        id: machine.id as MachineId,
        label: [machine.brand, machine.model].filter(Boolean).join(' ') || machine.id,
      }));
  }, [byId, ids]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Machines</Text>

      {loading && <Text style={{ color: '#9ca3af' }}>Loading machine registry…</Text>}
      {!!registryError && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#f87171' }}>Unable to load machines: {registryError.message}</Text>
          <Text
            style={{ color: '#60a5fa', textDecorationLine: 'underline' }}
            onPress={() => {
              void refresh();
            }}
          >
            Retry
          </Text>
        </View>
      )}

      {!loading && !registryError && machineChoices.length === 0 && (
        <Text style={{ color: '#9ca3af' }}>No machines found.</Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {machineChoices.map((machine) => {
          const active = machine.id === selectedId;
          return (
            <View
              key={machine.id}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: active ? '#4ade80' : '#333',
                paddingVertical: 8,
                paddingHorizontal: 10,
                backgroundColor: active ? '#052e16' : '#111',
              }}
            >
              <Text onPress={() => handleSelectMachine(machine.id)} style={{ color: 'white' }}>
                {machine.label}
              </Text>
            </View>
          );
        })}
      </View>

      {selectedMachine && (
        <View style={{ gap: 4 }}>
          {!!selectedMachine.type && (
            <Text style={{ color: '#9ca3af' }}>Type: {selectedMachine.type}</Text>
          )}
          {!!selectedMachine.capabilities?.length && (
            <Text style={{ color: '#9ca3af' }}>
              Capabilities: {selectedMachine.capabilities.join(', ')}
            </Text>
          )}
          {!!selectedMachine.material_presets && (
            <Text style={{ color: '#9ca3af' }}>
              Materials: {Object.keys(selectedMachine.material_presets).join(', ') || '—'}
            </Text>
          )}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: '#222', marginVertical: 8 }} />

      <Text style={{ fontSize: 20, fontWeight: '600' }}>Add photo</Text>

      {Platform.OS === 'web' ? (
        <WebFilePicker onPick={handleWebPick}>
          {(open) => (
            <Pressable
              testID="uploadAnalyzeCta"
              onPress={pendingImage ? handleAnalyze : open}
              disabled={!selectedMachine || status === 'uploading'}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor:
                  !selectedMachine || status === 'uploading' ? '#9ca3af' : '#2563eb',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                {pendingImage ? 'Analyze' : 'Upload Photo'}
              </Text>
            </Pressable>
          )}
        </WebFilePicker>
      ) : (
        <CameraButton
          label={status === 'uploading' ? 'Uploading…' : 'Take Photo'}
          onImageReady={handleImageReady}
          disabled={!selectedMachine || status === 'uploading'}
          testID="uploadAnalyzeCta"
        />
      )}

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>Analysis status</Text>
        <Text style={{ color: '#9ca3af' }}>{analysisStatusLabel}</Text>
        {status === 'uploading' && (
          <Text style={{ color: '#9ca3af' }}>Progress: {progress}%</Text>
        )}
        {analyzeError && (
          <Text style={{ color: '#f87171' }}>Last error: {analyzeError.message}</Text>
        )}
        {data && (
          <View style={{ gap: 2 }}>
            <Text style={{ color: '#34d399' }}>
              Predictions: {data.predictions.length} issue(s)
            </Text>
            <Text style={{ color: '#34d399' }}>
              Confidence: {data.low_confidence ? 'Low' : 'Normal'}
            </Text>
          </View>
        )}
      </View>

      {previews.length > 0 && (
        <>
          <Text style={{ marginTop: 12, color: '#9ca3af' }}>Recent photos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {previews.map((src) => (
              <Image
                key={src}
                source={{ uri: src }}
                style={{ width: 96, height: 96, borderRadius: 8, backgroundColor: '#222' }}
              />
            ))}
          </View>
        </>
      )}

      <View style={{ height: 1, backgroundColor: '#222', marginVertical: 8 }} />

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>API</Text>
        <Text style={{ color: '#9ca3af' }}>Base URL: {apiBase}</Text>
      </View>
    </ScrollView>
  );
}
