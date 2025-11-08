import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { CameraButton, type PreparedImage } from '../components/CameraButton';
import WebPhotoPicker from '../components/WebPhotoPicker';
import { useAnalyze } from '../hooks/useAnalyze';
import { useMachineRegistry, type MachineId, type Machine } from '../hooks/useMachineRegistry';
import type { AnalysisHistoryRecord, ExperienceLevel } from '../types';

type ProfileLike = {
  machineId: string;
  brand: string;
  model: string;
  experience?: ExperienceLevel;
  material?: string;
  materialByMachine?: Record<string, string | undefined>;
};

type PrinterTabsProps = {
  profile?: ProfileLike;
  onEditProfile?: () => void;
  onShowAnalysis?: (opts: { image?: { uri: string; width: number; height: number }; material?: string }) => void;
  onUpdateMaterial?: (machineId: string, material?: string) => void;
  onOpenHistory?: () => void;
  onRecordHistory?: (record: AnalysisHistoryRecord) => void;
  historyCounts?: Record<string, number>;
};

type AnalysisPreview = { uri: string; width: number; height: number };

type ExpoExtra = { apiBaseUrl?: string };

const PrinterTabs: React.FC<PrinterTabsProps> = ({
  profile,
  onEditProfile,
  onShowAnalysis,
  onUpdateMaterial,
  onOpenHistory,
  onRecordHistory,
  historyCounts,
}) => {
  const registryResult = useMachineRegistry() as Partial<{
    all: Machine[];
    machines: Machine[];
    ids: MachineId[];
    defaultId: MachineId;
    byId: (id: MachineId) => Machine | undefined;
  }>;
  const registryMachines = (registryResult.all ?? registryResult.machines ?? []) as Machine[];
  const registryIds = (registryResult.ids ?? registryMachines.map((m) => m.id)) as MachineId[];
  const registryDefaultId = (registryResult.defaultId ??
    (registryIds[0] as MachineId | undefined) ??
    'bambu_p1s') as MachineId;
  const registryById =
    (registryResult.byId as ((id: MachineId) => Machine | undefined) | undefined) ??
    ((id: MachineId) => registryMachines.find((m) => m.id === id));

  const initialMachineId = useMemo(() => {
    if (profile?.machineId) {
      return profile.machineId as MachineId;
    }
    return registryDefaultId;
  }, [profile?.machineId, registryDefaultId]);

  const [selectedId, setSelectedId] = useState<MachineId>(initialMachineId);

  useEffect(() => {
    if (profile?.machineId) {
      setSelectedId(profile.machineId as MachineId);
    }
  }, [profile?.machineId]);

  const lookup = useCallback((id: MachineId) => registryById(id), [registryById]);

  const selectedMachine: Machine | undefined = useMemo(
    () => lookup(selectedId) ?? undefined,
    [lookup, selectedId]
  );

  const machineLabel = profile
    ? `${profile.brand} ${profile.model}`
    : selectedMachine
    ? `${selectedMachine.brand} ${selectedMachine.model}`
    : selectedId;

  const experience = (profile?.experience ?? 'Intermediate') as ExperienceLevel;

  const deriveMaterial = useCallback(() => {
    if (profile?.materialByMachine?.[profile.machineId]) {
      return profile.materialByMachine[profile.machineId] ?? '';
    }
    if (profile?.material) {
      return profile.material;
    }
    return selectedMachine?.materials?.[0] ?? '';
  }, [profile?.material, profile?.materialByMachine, profile?.machineId, selectedMachine]);

  const [material, setMaterial] = useState<string>(deriveMaterial);

  useEffect(() => {
    setMaterial(deriveMaterial);
  }, [deriveMaterial]);

  const [selectedImage, setSelectedImage] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<AnalysisPreview | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastImageRef = useRef<PreparedImage | null>(null);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        previews.forEach((uri) => {
          if (uri.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(uri);
            } catch {
              // Ignore revocation errors for already released blobs.
            }
          }
        });
      }
    };
  }, [previews]);

  const { mutate } = useAnalyze();

  const handlePreparedImage = useCallback((image: PreparedImage) => {
    lastImageRef.current = image;
    setSelectedImage(image);
    setPreview({ uri: image.uri, width: image.width ?? 0, height: image.height ?? 0 });
    setPreviews((prev) => [image.uri, ...prev.filter((uri) => uri !== image.uri)].slice(0, 6));
  }, []);

  const onPhotoNative = useCallback(
    (image: PreparedImage) => {
      handlePreparedImage(image);
    },
    [handlePreparedImage]
  );

  const onPickWeb = useCallback(
    (file: File, objectUrl: string) => {
      const prepared: PreparedImage = {
        uri: objectUrl,
        width: 0,
        height: 0,
        name: file.name ?? 'photo.jpg',
        type: file.type || 'image/jpeg',
        blob: file,
        size: file.size,
      };
      handlePreparedImage(prepared);
    },
    [handlePreparedImage]
  );

  const machineIdForMeta = profile?.machineId ?? selectedMachine?.id ?? selectedId;
  const materialForMeta = material || profile?.material || undefined;

  const handleAnalyze = useCallback(async () => {
    const image = lastImageRef.current;
    if (!image) {
      if (Platform.OS !== 'web') {
        Alert.alert('No photo selected', 'Please choose or capture a photo first.');
      }
      setErrorMessage('Please choose a photo first.');
      return;
    }
    const meta = {
      machine_id: machineIdForMeta,
      experience,
      material: materialForMeta,
      app_version: 'printer-page',
    };
    const fileArg =
      image.blob ?? ({
        uri: image.uri,
        name: image.name ?? 'photo.jpg',
        type: image.type ?? 'image/jpeg',
      } as const);
    try {
      setUploading(true);
      setErrorMessage(null);
      await mutate({ file: fileArg as any, meta } as any);
      const imagePreview = preview ?? {
        uri: image.uri,
        width: image.width ?? 0,
        height: image.height ?? 0,
      };
      onRecordHistory?.({
        imageId: 'local',
        machineId: machineIdForMeta,
        machine: {
          id: machineIdForMeta,
          brand: profile?.brand ?? selectedMachine?.brand ?? '',
          model: profile?.model ?? selectedMachine?.model ?? '',
        },
        timestamp: Date.now(),
        predictions: [],
        response: {
          image_id: 'local',
          version: 'local',
          machine: { id: machineIdForMeta },
          experience,
          material: materialForMeta,
          predictions: [],
          explanations: [],
          localization: { boxes: [], heatmap: null },
          capability_notes: [],
          recommendations: [],
          suggestions: [],
          applied: {
            parameters: {},
            hidden_parameters: [],
            experience_level: experience,
            clamped_to_machine_limits: false,
            explanations: [],
          },
          low_confidence: false,
        },
        material: materialForMeta,
        localUri: imagePreview.uri,
        summary: selectedMachine,
      });
      onShowAnalysis?.({ image: imagePreview, material: materialForMeta });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  }, [
    experience,
    materialForMeta,
    mutate,
    onRecordHistory,
    onShowAnalysis,
    preview,
    profile?.brand,
    profile?.model,
    selectedMachine,
    machineIdForMeta,
  ]);

  const historyCount = historyCounts?.[machineIdForMeta] ?? 0;

  const apiBase =
    (Constants?.expoConfig?.extra as ExpoExtra | undefined)?.apiBaseUrl ??
    'http://localhost:8000';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{machineLabel}</Text>
          <Text style={styles.subtitle}>
            ID: {machineIdForMeta}
            {profile?.experience ? ` • ${profile.experience}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {onEditProfile ? (
            <Pressable onPress={onEditProfile} style={[styles.button, styles.secondaryBtn]}>
              <Text style={styles.secondaryLabel}>Edit</Text>
            </Pressable>
          ) : null}
          {onOpenHistory ? (
            <Pressable onPress={onOpenHistory} style={[styles.button, styles.primaryBtn]}>
              <Text style={styles.primaryLabel}>History ({historyCount})</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Machines</Text>
      <View style={styles.machineRow}>
        {registryIds.map((id) => {
          const machine = lookup(id);
          if (!machine) return null;
          const active = id === selectedId;
          return (
            <Pressable
              key={id}
              onPress={() => setSelectedId(id)}
              style={[
                styles.machineChip,
                active ? styles.machineChipActive : styles.machineChipInactive,
              ]}
            >
              <Text style={active ? styles.machineChipActiveLabel : styles.machineChipLabel}>
                {machine.brand} {machine.model}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Material</Text>
        <TextInput
          value={material}
          onChangeText={setMaterial}
          placeholder="e.g., PLA, PETG"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        {onUpdateMaterial ? (
          <Pressable
            onPress={() => onUpdateMaterial(machineIdForMeta, material)}
            style={[styles.button, styles.secondaryBtn, styles.inlineButton]}
          >
            <Text style={styles.secondaryLabel}>Save material</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photo</Text>
        <View style={{ alignSelf: 'flex-start' }}>
          {Platform.OS === 'web' ? (
            <WebPhotoPicker label="Add photo" onPick={onPickWeb} />
          ) : (
            <CameraButton
              disabled={uploading}
              label="Pick / Capture photo"
              onImageReady={onPhotoNative}
            />
          )}
        </View>

        {preview ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: preview.uri }} style={styles.preview} />
            <Text style={styles.noteText}>
              Selected {preview.width}×{preview.height}
            </Text>
          </View>
        ) : (
          <Text style={styles.noteText}>No photo selected yet.</Text>
        )}

        <Pressable
          disabled={!selectedImage || uploading}
          onPress={handleAnalyze}
          style={[
            styles.button,
            !selectedImage || uploading ? styles.disabledBtn : styles.primaryBtn,
          ]}
        >
          <Text
            style={
              !selectedImage || uploading ? styles.disabledLabel : styles.primaryLabel
            }
          >
            {uploading ? 'Analyzing…' : 'Analyze photo'}
          </Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {previews.length > 0 ? (
          <View style={styles.gallery}>
            {previews.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.galleryItem} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>API</Text>
        <Text style={styles.noteText}>Base URL: {apiBase}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingBottom: 12,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  subtitle: { color: '#94a3b8', marginTop: 4 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  machineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  machineChip: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  machineChipInactive: { borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#0f172a' },
  machineChipActive: { borderWidth: 1, borderColor: '#4ade80', backgroundColor: '#052e16' },
  machineChipLabel: { color: '#e2e8f0' },
  machineChipActiveLabel: { color: '#bbf7d0' },
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
  button: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButton: { alignSelf: 'flex-start' },
  primaryBtn: { backgroundColor: '#38bdf8' },
  primaryLabel: { color: '#0f172a', fontWeight: '700' },
  secondaryBtn: { borderColor: '#38bdf8', borderWidth: 1, backgroundColor: 'transparent' },
  secondaryLabel: { color: '#e0f2fe', fontWeight: '600' },
  disabledBtn: { backgroundColor: '#1f2937' },
  disabledLabel: { color: '#64748b', fontWeight: '600' },
  noteText: { color: '#94a3b8' },
  errorText: { color: '#ef4444' },
  previewWrap: { gap: 8 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: '#0b1220' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: { width: 96, height: 96, borderRadius: 8, backgroundColor: '#0b1220' },
});

export default PrinterTabs;
