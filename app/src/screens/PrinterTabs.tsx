import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, View, Text, Image } from 'react-native';
import Constants from 'expo-constants';
import CameraButton from '../components/CameraButton';
import WebPhotoPicker from '../components/WebPhotoPicker';
import { useMachineRegistry, type MachineId, type Machine } from '../hooks/useMachineRegistry';

type ExpoExtra = { apiBaseUrl?: string };

export default function PrinterTabs() {
  const { ids, byId, defaultId } = useMachineRegistry();
  const [selectedId, setSelectedId] = useState<MachineId>(defaultId);
  const [previews, setPreviews] = useState<string[]>([]);

  const apiBase =
    (Constants?.expoConfig?.extra as ExpoExtra | undefined)?.apiBaseUrl ??
    'http://localhost:8000';

  const selectedMachine: Machine | undefined = useMemo(() => byId(selectedId), [byId, selectedId]);

  const onPickWeb = useCallback((_: File, objectUrl: string) => {
    setPreviews((p) => [objectUrl, ...p].slice(0, 6));
  }, []);

  const onPhotoNative = useCallback((uri: string) => {
    setPreviews((p) => [uri, ...p].slice(0, 6));
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Machines</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ids.map((id) => {
          const m = byId(id)!;
          const active = id === selectedId;
          return (
            <View
              key={id}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: active ? '#4ade80' : '#333',
                paddingVertical: 8,
                paddingHorizontal: 10,
                backgroundColor: active ? '#052e16' : '#111',
              }}
            >
              <Text
                onPress={() => setSelectedId(id)}
                style={{ color: 'white' }}
              >
                {m.brand} {m.model}
              </Text>
            </View>
          );
        })}
      </View>

      {selectedMachine && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#9ca3af' }}>
            Nozzle {selectedMachine.nozzleDiameterMm}mm · Volume {selectedMachine.buildVolumeMm.x}×{selectedMachine.buildVolumeMm.y}×{selectedMachine.buildVolumeMm.z}mm
          </Text>
          <Text style={{ color: '#9ca3af' }}>
            Materials: {selectedMachine.materials.join(', ')}
          </Text>
        </View>
      )}

      <View style={{ height: 1, backgroundColor: '#222', marginVertical: 8 }} />

      <Text style={{ fontSize: 20, fontWeight: '600' }}>Add photo</Text>

      {Platform.OS === 'web' ? (
        <WebPhotoPicker label="Add photo" onPick={onPickWeb} />
      ) : (
        // CameraButton API varies across projects; use minimal, safe prop.
        // If your component expects a different prop (e.g., onCapture/onImage),
        // adapt here — but keep it typed.
        <CameraButton onPhoto={onPhotoNative} />
      )}

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
