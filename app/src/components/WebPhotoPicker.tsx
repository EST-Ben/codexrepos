import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';

import analyzeImage from '../api/analyzeImage';
import type { AnalyzeResponse, ExperienceLevel } from '../types';

interface WebPhotoPickerProps {
  machineId: string;
  material?: string;
  experience: ExperienceLevel;
  onResult(response: AnalyzeResponse): void;
  onError(message: string): void;
  label?: string;
  appVersion?: string;
  onPreviewReady?(preview: { uri: string; width: number; height: number }): void;
  onBusyChange?(busy: boolean): void;
}

export const WebPhotoPicker: React.FC<WebPhotoPickerProps> = ({
  machineId,
  material,
  experience,
  onResult,
  onError,
  label = 'Choose Photo',
  appVersion = 'web-photo-picker',
  onPreviewReady,
  onBusyChange,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    onBusyChange?.(isUploading);
  }, [isUploading, onBusyChange]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current && typeof URL !== 'undefined') {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const resetInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (objectUrlRef.current && typeof URL !== 'undefined') {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const meta = {
        machine_id: machineId,
        experience,
        app_version: appVersion,
        ...(material ? { material } : {}),
      };

      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;

      try {
        setIsUploading(true);
        if (onPreviewReady) {
          const ImageCtor = typeof Image !== 'undefined' ? Image : undefined;
          if (ImageCtor) {
            const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
              const img = new ImageCtor();
              const anyImg = img as any;
              anyImg.onload = () =>
                resolve({
                  width: typeof anyImg.width === 'number' ? anyImg.width : 0,
                  height: typeof anyImg.height === 'number' ? anyImg.height : 0,
                });
              anyImg.onerror = () => resolve({ width: 0, height: 0 });
              anyImg.src = nextUrl;
            });
            onPreviewReady({ uri: nextUrl, width: dimensions.width, height: dimensions.height });
          } else {
            onPreviewReady({ uri: nextUrl, width: 0, height: 0 });
          }
        }

        const form = new FormData();
        form.append('image', file, file.name ?? 'upload.jpg');
        form.append('meta', JSON.stringify(meta));

        const response = await analyzeImage(form);
        onResult(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError(message);
      } finally {
        setIsUploading(false);
        resetInput();
      }
    },
    [appVersion, experience, machineId, material, onError, onPreviewReady, onResult, resetInput],
  );

  const handlePress = useCallback(() => {
    if (isUploading) {
      return;
    }
    inputRef.current?.click();
  }, [isUploading]);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={isUploading}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: isUploading ? '#9ca3af' : '#2563eb',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>{isUploading ? 'Uploading…' : label}</Text>
      </Pressable>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default WebPhotoPicker;
