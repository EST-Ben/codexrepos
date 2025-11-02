import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ChangeEvent } from 'react';

export interface PreparedImage {
  blob: Blob;
  uri: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
}

interface CameraButtonProps {
  disabled?: boolean;
  label?: string;
  floating?: boolean;
  onImageReady(image: PreparedImage): void;
}

const MAX_EDGE = 2048;

export const CameraButton: React.FC<CameraButtonProps> = ({
  disabled,
  label = 'Take Photo',
  floating = true,
  onImageReady,
}) => {
  const [preview, setPreview] = useState<PreparedImage | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const webPreviewUri = useRef<string | null>(null);

  const formatSize = useCallback((bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, index);
    return `${size.toFixed(1)} ${units[index]}`;
  }, []);

  const prepareImage = useCallback(async (result: ImagePicker.ImagePickerResult) => {
    if (!result.assets?.length) {
      return;
    }
    const asset = result.assets[0];
    const width = asset.width ?? MAX_EDGE;
    const height = asset.height ?? MAX_EDGE;
    const longest = Math.max(width, height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const actions: ImageManipulator.Action[] = [];
    if (scale < 1) {
      actions.push({ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } });
    }
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      actions,
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    const response = await fetch(manipulated.uri);
    const blob = await response.blob();
    const prepared: PreparedImage = {
      blob,
      uri: manipulated.uri,
      name: asset.fileName ?? 'upload.jpg',
      type: blob.type || 'image/jpeg',
      size: blob.size,
      width: manipulated.width ?? width,
      height: manipulated.height ?? height,
    };
    setPreview(prepared);
    setModalVisible(true);
  }, []);

  const prepareWebFile = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    webPreviewUri.current = objectUrl;
    let width = 1024;
    let height = 1024;
    try {
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 1024, height: 1024 });
        img.src = objectUrl;
      });
      width = dims.width;
      height = dims.height;
    } catch (err) {
      console.warn('Failed to read web image dimensions', err);
    }
    const prepared: PreparedImage = {
      blob: file,
      uri: objectUrl,
      name: file.name ?? 'upload.jpg',
      type: file.type || 'image/jpeg',
      size: file.size,
      width,
      height,
    };
    setPreview(prepared);
    setModalVisible(true);
  }, []);

  useEffect(() => {
    return () => {
      if (webPreviewUri.current) {
        URL.revokeObjectURL(webPreviewUri.current);
        webPreviewUri.current = null;
      }
    };
  }, []);

  const launchCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      base64: false,
      exif: false,
    });
    if (!result.canceled) {
      await prepareImage(result);
    }
  }, [prepareImage]);

  const launchPicker = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed to pick photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.85,
      base64: false,
      exif: false,
    });
    if (!result.canceled) {
      await prepareImage(result);
    }
  }, [prepareImage]);

  const handlePress = useCallback(() => {
    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }
    Alert.alert('Add a photo', 'Choose how you want to provide a photo of your print.', [
      { text: 'Take Photo', onPress: launchCamera },
      { text: 'Upload from Library', onPress: launchPicker },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [launchCamera, launchPicker]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      await prepareWebFile(file);
    },
    [prepareWebFile],
  );

  const clearPreview = useCallback((preserveUri: boolean = false) => {
    if (!preserveUri && Platform.OS === 'web' && webPreviewUri.current) {
      URL.revokeObjectURL(webPreviewUri.current);
      webPreviewUri.current = null;
    }
    setPreview(null);
  }, []);

  const confirmDisabled = useMemo(() => !preview, [preview]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={[
          styles.button,
          floating ? styles.buttonFloating : styles.buttonInline,
          disabled && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text style={styles.label}>{disabled ? 'Uploading…' : label}</Text>
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
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {preview && (
              <>
                <Image source={{ uri: preview.uri }} style={styles.preview} />
                <Text style={styles.modalTitle}>Ready to analyze?</Text>
                <Text style={styles.modalDetail}>Resolution: {preview.width}×{preview.height}</Text>
                <Text style={styles.modalDetail}>File size: {formatSize(preview.size)}</Text>
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
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
  },
  buttonFloating: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
  buttonInline: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  label: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  preview: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  modalDetail: {
    color: '#cbd5f5',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalCancel: {
    backgroundColor: '#1f2937',
  },
  modalCancelLabel: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  modalConfirmLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
