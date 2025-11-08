// app/src/components/CameraButton.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ChangeEvent } from 'react';

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
  name: string;
  type: string;
  blob?: Blob;
  size?: number; // added so we can show file size on web
}

interface CameraButtonProps {
  disabled?: boolean;
  label?: string;
  onImageReady(image: PreparedImage): void;
}

const FALLBACK_NAME = 'photo.jpg';

// ---- helpers -------------------------------------------------

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

async function toBlob(uri: string): Promise<Blob | null> {
  try {
    const res = await fetch(uri);
    return await res.blob();
  } catch {
    return null;
  }
}

async function getWebImageDims(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = objectUrl;
  });
}

// ---- component -----------------------------------------------

export const CameraButton: React.FC<CameraButtonProps> = ({
  disabled,
  label = 'Take Photo',
  onImageReady,
}) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreparedImage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const webInputRef = useRef<HTMLInputElement | null>(null);
  const webPreviewUri = useRef<string | null>(null);

  // Web: <input type="file"> change handler
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // reset input so the same file can be selected again
      event.target.value = '';
      if (!file) return;

      setBusy(true);
      try {
        const objectUrl = URL.createObjectURL(file);
        webPreviewUri.current = objectUrl;
        const { width, height } = await getWebImageDims(objectUrl);

        const prepared: PreparedImage = {
          uri: objectUrl,
          width,
          height,
          name: file.name ?? FALLBACK_NAME,
          type: file.type || 'image/jpeg',
          blob: file,
          size: file.size,
        };

        setPreview(prepared);
        setModalVisible(true);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    // cleanup web object URLs
    return () => {
      if (webPreviewUri.current) {
        URL.revokeObjectURL(webPreviewUri.current);
        webPreviewUri.current = null;
      }
    };
  }, []);

  const launchCamera = useCallback(async () => {
    setBusy(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: false,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const blob = await toBlob(asset.uri);
        const prepared: PreparedImage = {
          uri: asset.uri,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          name: (asset as any).fileName ?? FALLBACK_NAME,
          type: blob?.type || 'image/jpeg',
          blob: blob ?? undefined,
          size: (blob as any)?.size,
        };
        // Native flow: send immediately (no modal)
        onImageReady(prepared);
      }
    } finally {
      setBusy(false);
    }
  }, [onImageReady]);

  const launchPicker = useCallback(async () => {
    setBusy(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed to select a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        base64: false,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const blob = await toBlob(asset.uri);
        const prepared: PreparedImage = {
          uri: asset.uri,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          name: (asset as any).fileName ?? FALLBACK_NAME,
          type: blob?.type || 'image/jpeg',
          blob: blob ?? undefined,
          size: (blob as any)?.size,
        };
        // Native flow: send immediately (no modal)
        onImageReady(prepared);
      }
    } finally {
      setBusy(false);
    }
  }, [onImageReady]);

  const clearPreview = useCallback((preserveUri: boolean = false) => {
    if (!preserveUri && Platform.OS === 'web' && webPreviewUri.current) {
      URL.revokeObjectURL(webPreviewUri.current);
      webPreviewUri.current = null;
    }
    setPreview(null);
  }, []);

  // Single, unified press handler
  const handlePress = useCallback(() => {
    if (disabled || busy) return;

    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }

    Alert.alert('Add a photo', 'Choose how you want to provide a photo of your print.', [
      { text: 'Take Photo', onPress: launchCamera },
      { text: 'Upload from Library', onPress: launchPicker },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [disabled, busy, launchCamera, launchPicker]);

  const confirmDisabled = useMemo(() => !preview, [preview]);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={disabled || busy}
        style={[
          styles.button,
          (disabled || busy) && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.label}>
          {disabled ? 'Uploading…' : label}
        </Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <input
          ref={webInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      ) : null}

      {/* Web-only preview modal (native flows send immediately) */}
      {Platform.OS === 'web' && (
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              {preview && (
                <>
                  <Image source={{ uri: preview.uri }} style={styles.preview} />
                  <Text style={styles.modalTitle}>Ready to analyze?</Text>
                  <Text style={styles.modalDetail}>
                    Resolution: {preview.width}×{preview.height}
                  </Text>
                  <Text style={styles.modalDetail}>
                    File size: {formatSize(preview.size)}
                  </Text>
                </>
              )}
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => {
                    setModalVisible(false);
                    clearPreview();
                  }}
                >
                  <Text style={styles.modalCancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, confirmDisabled && styles.modalButtonDisabled]}
                  disabled={confirmDisabled}
                  onPress={() => {
                    if (preview) {
                      onImageReady(preview);
                    }
                    setModalVisible(false);
                    clearPreview(true);
                  }}
                >
                  <Text style={styles.modalConfirmLabel}>Send</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

export default CameraButton;

// ---- styles --------------------------------------------------
const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  label: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  preview: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalDetail: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 2,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  } as any,
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalCancel: {
    backgroundColor: '#e5e7eb',
  },
  modalCancelLabel: {
    color: '#111827',
    fontWeight: '600',
  },
  modalConfirmLabel: {
    color: 'white',
    fontWeight: '700',
  },
});
