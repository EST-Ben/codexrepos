// app/src/screens/PrinterTabs.tsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
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

type SelectedImage = { uri: string; width: number; height: number };

type HistoryCounts = Record<string, number>;

interface PrinterTabsProps {
  profile: {
    machineId: string;
    brand: string;
    model: string;
    experience?: string;
    material?: string;
  };
  onEditProfile: () => void;
  onShowAnalysis: (opts: { image?: SelectedImage; material?: string }) => void;
  onUpdateMaterial: (material: string) => void;
  onOpenHistory: () => void;
  onRecordHistory?: (record: unknown) => void;
  historyCounts?: HistoryCounts;
}

/**
 * Web-only tiny photo picker that returns a blob URL.
 * (No duplicate identifier; name is unique in this file.)
 */
const TinyWebPhotoPicker: React.FC<{ onPick: (img: SelectedImage) => void }> = ({ onPick }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    // We can't get real dimensions synchronously; best effort: load Image to get w/h
    const img = new window.Image();
    img.onload = () => {
      onPick({ uri: url, width: img.width, height: img.height });
    };
    img.onerror = () => {
      // Fallback size (4:3) if dimension read fails
      onPick({ uri: url, width: 1200, height: 900 });
    };
    img.src = url;
  }, [onPick]);

  return (
    <View>
      <Pressable
        onPress={() => inputRef.current?.click()}
        style={[styles.button, styles.secondaryBtn]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryLabel}>Choose photo</Text>
      </Pressable>
      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </View>
  );
};

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
  const [selectedImage, setSelectedImage] = useState<SelectedImage | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const analyzeDisabled = !selectedImage;

  const handleAnalyze = useCallback(() => {
    if (!selectedImage) {
      Alert.alert('No photo selected', 'Please choose or capture a photo first.');
      return;
    }
    setErrorMessage(null);
    onShowAnalysis({ image: selectedImage, material: material || profile.material });
  }, [onShowAnalysis, selectedImage, material, profile.material]);

  const handlePickNative = useCallback(() => {
    // Keep native path minimal & compile-safe: you can wire to your picker later.
    Alert.alert(
      'Native picker not wired yet',
      'Hook up your preferred image picker here and call setSelectedImage({...}).'
    );
  }, []);

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

          {Platform.OS === 'web' ? (
            <TinyWebPhotoPicker onPick={setSelectedImage} />
          ) : (
            <Pressable
              onPress={handlePickNative}
              style={[styles.button, styles.secondaryBtn, { alignSelf: 'flex-start' }]}
            >
              <Text style={styles.secondaryLabel}>Pick / Capture photo</Text>
            </Pressable>
          )}

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
              Analyze photo
            </Text>
          </Pressable>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
