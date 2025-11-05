// app/src/screens/PrinterTabs.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import type { ExperienceLevel } from '../types';
import { CameraButton, type PreparedImage } from '../components/CameraButton';
import { useAnalyze } from '../hooks/useAnalyze';

type HistoryCounts = Record<string, number>;
type AnalysisPreview = { uri: string; width: number; height: number };

interface PrinterTabsProps {
  profile: {
    machineId: string;
    brand: string;
    model: string;
    experience?: string;
    material?: string;
  };
  onEditProfile: () => void;
  onShowAnalysis: (opts: { image?: AnalysisPreview; material?: string }) => void;
  onUpdateMaterial: (material: string) => void;
  onOpenHistory: () => void;
  onRecordHistory?: (record: unknown) => void;
  historyCounts?: HistoryCounts;
}

const PrinterTabs: React.FC<PrinterTabsProps> = ({
  profile,
  onEditProfile,
  onShowAnalysis,
  onUpdateMaterial,
  onOpenHistory,
  onRecordHistory,
  historyCounts,
}) => {
  const [material, setMaterial] = useState(profile.material ?? '');
  const [selectedImage, setSelectedImage] = useState<PreparedImage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { mutate } = useAnalyze();

  // Revoke blob URL when changing / unmounting (web only)
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && selectedImage?.uri?.startsWith('blob:')) {
        try { URL.revokeObjectURL(selectedImage.uri); } catch {}
      }
    };
  }, [selectedImage?.uri]);

  const machineTitle = useMemo(
    () => `${profile.brand} ${profile.model}`,
    [profile.brand, profile.model]
  );

  const performAnalysis = useCallback(
    (prepared: PreparedImage) => {
      setErrorMessage(null);
      setUploading(true);
      const experienceLevel = (profile.experience ?? 'Intermediate') as ExperienceLevel;
      const meta = {
        machine_id: profile.machineId,
        experience: experienceLevel,
        material: material || profile.material,
        app_version: 'printer-page',
      };
      const fileArg =
        prepared.blob ?? ({ uri: prepared.uri, name: prepared.name, type: prepared.type } as const);

      mutate(
        { file: fileArg, meta },
        {
          onSuccess: (response) => {
            onRecordHistory?.({
              imageId: response.image_id,
              machineId: profile.machineId,
              material: material || profile.material,
              response,
              timestamp: Date.now(),
            });
            onShowAnalysis({
              image: { uri: prepared.uri, width: prepared.width, height: prepared.height },
              material: material || profile.material,
            });
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : String(err);
            setErrorMessage(message);
          },
          onSettled: () => {
            setUploading(false);
          },
        },
      );
    },
    [material, mutate, onRecordHistory, onShowAnalysis, profile.experience, profile.machineId, profile.material],
  );

  const handleImageReady = useCallback(
    (image: PreparedImage) => {
      setSelectedImage(image);
      return performAnalysis(image);
    },
    [performAnalysis],
  );

  const analyzeDisabled = !selectedImage || uploading;

  const handleAnalyze = useCallback(() => {
    if (!selectedImage) {
      Alert.alert('No photo selected', 'Please choose or capture a photo first.');
      return;
    }
    return performAnalysis(selectedImage);
  }, [performAnalysis, selectedImage]);

  const historyCountForMachine = historyCounts?.[profile.machineId] ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{machineTitle}</Text>
          <Text style={styles.subtitle}>
            ID: {profile.machineId}{profile.experience ? ` • ${profile.experience}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onEditProfile} style={[styles.button, styles.secondaryBtn]}>
            <Text style={styles.secondaryLabel}>Edit</Text>
          </Pressable>
          <Pressable onPress={onOpenHistory} style={[styles.button, styles.primaryBtn]}>
            <Text style={styles.primaryLabel}>History ({historyCountForMachine})</Text>
          </Pressable>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Material field */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Material</Text>
          <TextInput
            value={material}
            onChangeText={setMaterial}
            placeholder="e.g., PLA, PETG"
            placeholderTextColor="#64748b"
            style={styles.input}
          />
          <Pressable
            onPress={() => onUpdateMaterial(material)}
            style={[styles.button, styles.secondaryBtn, { alignSelf: 'flex-start' }]}
          >
            <Text style={styles.secondaryLabel}>Save material</Text>
          </Pressable>
        </View>

        {/* Photo & Analyze */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photo</Text>

          <View style={{ alignSelf: 'flex-start' }}>
            <CameraButton
              disabled={uploading}
              label={Platform.OS === 'web' ? 'Choose photo' : 'Pick / Capture photo'}
              onImageReady={handleImageReady}
            />
          </View>

          {selectedImage ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: selectedImage.uri }} style={styles.preview} />
              <Text style={styles.noteText}>
                Selected {selectedImage.width}×{selectedImage.height}
              </Text>
            </View>
          ) : (
            <Text style={styles.noteText}>No photo selected yet.</Text>
          )}

          <Pressable
            disabled={analyzeDisabled}
            onPress={handleAnalyze}
            style={[styles.button, analyzeDisabled ? styles.disabledBtn : styles.primaryBtn]}
          >
            <Text style={analyzeDisabled ? styles.disabledLabel : styles.primaryLabel}>
              {uploading ? 'Analyzing…' : 'Analyze photo'}
            </Text>
          </Pressable>

        </View>

        {/* Optional: record to history */}
        {onRecordHistory ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Record</Text>
            <Text style={styles.noteText}>
              You can record analysis results in your history after you run an analysis.
            </Text>
            <Pressable
              onPress={() => onRecordHistory?.({
                machineId: profile.machineId,
                when: Date.now(),
              })}
              style={[styles.button, styles.secondaryBtn, { alignSelf: 'flex-start' }]}
            >
              <Text style={styles.secondaryLabel}>Record placeholder</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  subtitle: { color: '#cbd5f5', marginTop: 4 },

  body: { padding: 16, gap: 16 },

  card: { backgroundColor: '#111827', borderRadius: 12, padding: 16, gap: 12 },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },

  input: {
    backgroundColor: '#0b1220',
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // Buttons
  button: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: { backgroundColor: '#38bdf8' },
  primaryLabel: { color: '#0f172a', fontWeight: '700' },
  secondaryBtn: { borderColor: '#38bdf8', borderWidth: 1, backgroundColor: 'transparent' },
  secondaryLabel: { color: '#e0f2fe', fontWeight: '600' },
  disabledBtn: { backgroundColor: '#1f2937' },
  disabledLabel: { color: '#64748b', fontWeight: '600' },

  // Preview
  previewWrap: { gap: 8 },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: '#0b1220',
  },
  noteText: { color: '#94a3b8' },
  errorText: { color: '#ef4444' },
});

export default PrinterTabs;
