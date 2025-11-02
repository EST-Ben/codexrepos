import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ChangeEvent } from 'react';

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
  name: string;
  type: string;
  blob?: Blob;
}

interface CameraButtonProps {
  disabled?: boolean;
  label?: string;
  onImageReady(image: PreparedImage): void;
}

const FALLBACK_NAME = 'photo.jpg';

export const CameraButton: React.FC<CameraButtonProps> = ({ disabled, onImageReady }) => {
  const [preview, setPreview] = useState<PreparedImage | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const webPreviewUri = useRef<string | null>(null);

export const CameraButton: React.FC<CameraButtonProps> = ({
  disabled,
  label = 'Take Photo',
  onImageReady,
}) => {
  const [busy, setBusy] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);

  const handleWebChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setBusy(true);
      const objectUrl = URL.createObjectURL(file);
      try {
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 0, height: 0 });
          img.src = objectUrl;
        });
        onImageReady({
          uri: objectUrl,
          width: dimensions.width,
          height: dimensions.height,
          name: file.name ?? FALLBACK_NAME,
          type: file.type || 'image/jpeg',
          blob: file,
        });
      } finally {
        setBusy(false);
        event.target.value = '';
      }
    },
    [onImageReady],
  );

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
        onImageReady({
          uri: asset.uri,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          name: asset.fileName ?? FALLBACK_NAME,
          type: blob?.type || 'image/jpeg',
          blob: blob ?? undefined,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [onImageReady]);

  const handlePress = useCallback(() => {
    if (disabled || busy) {
      return;
    }
    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
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
        onPress={handlePress}
        disabled={disabled || busy}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: disabled || busy ? '#9ca3af' : '#2563eb',
          alignItems: 'center',
        }}
      >
        <Text style={styles.label}>{disabled ? 'Uploading…' : 'Take Photo'}</Text>
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

export default CameraButton;
