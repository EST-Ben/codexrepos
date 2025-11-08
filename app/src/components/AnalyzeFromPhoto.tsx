import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { analyzeImage as analyzeWithClient } from '../api/client';
import type { AnalyzeRequestMeta, AnalyzeResponse, ExperienceLevel } from '../types';

type Props = {
  machineId: string;
  material?: string;
  experience: ExperienceLevel;
  appVersion?: string;
  onResult(res: AnalyzeResponse): void;
  onError(msg: string): void;
};

const AnalyzeFromPhoto: React.FC<Props> = ({
  machineId,
  material,
  experience,
  appVersion = 'analyze-from-photo',
  onResult,
  onError,
}) => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePick = useCallback(async () => {
    try {
      setBusy(true);
      setProgress(0);

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Camera permission not granted');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) {
        setBusy(false);
        return;
      }

      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      };

      const meta: AnalyzeRequestMeta = {
        machine_id: machineId,
        experience,
        material,
        app_version: appVersion,
      };

      // NOTE: Pass 3rd arg (onProgress) to satisfy the updated client signature.
      const response = await analyzeWithClient(file as any, meta, (p) => setProgress(p ?? 0));
      onResult(response);
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [appVersion, experience, machineId, material, onError, onResult]);

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePick} style={[styles.button, busy && styles.buttonDisabled]} disabled={busy}>
        {busy ? (
          <>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.buttonLabel}>
              {Platform.OS === 'web' ? `Uploading… ${Math.round(progress * 100)}%` : 'Uploading…'}
            </Text>
          </>
        ) : (
          <Text style={styles.buttonLabel}>Analyze from Photo</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  button: {
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { color: '#0f172a', fontWeight: '700' },
});

export default AnalyzeFromPhoto;
