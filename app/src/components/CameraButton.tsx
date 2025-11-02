import React, { useCallback, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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

async function toBlob(uri: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(uri);
    return await response.blob();
  } catch (error) {
    console.warn('Failed to fetch image blob', error);
    return undefined;
  }
}

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
    void launchCamera();
  }, [busy, disabled, launchCamera]);

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
        <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? 'Opening…' : label}</Text>
      </Pressable>
      {Platform.OS === 'web' ? (
        <input
          ref={webInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleWebChange}
          style={{ display: 'none' }}
        />
      ) : null}
    </>
  );
};

export default CameraButton;
