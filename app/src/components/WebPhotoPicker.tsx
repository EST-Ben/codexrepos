<<<<<<< HEAD
// app/src/components/WebPhotoPicker.tsx
import React, { useRef, useState } from "react";
import { Platform } from "react-native";
import { analyzeImage } from "../api/client";
import type { AnalyzeResponse, ExperienceLevel } from "../types";

type Props = {
  machineId: string;
  material: string;
  experience: ExperienceLevel;
  onResult: (res: AnalyzeResponse) => void;
  onError?: (msg: string) => void;
  label?: string;
};

export default function WebPhotoPicker({
=======
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
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
  machineId,
  material,
  experience,
  onResult,
  onError,
<<<<<<< HEAD
  label = "Choose photo",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  function openPicker() {
    if (Platform.OS !== "web") {
      onError?.("WebPhotoPicker is web-only; use CameraButton on native.");
      return;
    }
    inputRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await analyzeImage(file, {
        machine_id: machineId,
        experience,
        material,
        app_version: "web-inline",
      });
      onResult(res);
    } catch (err: any) {
      onError?.(err?.message ?? String(err));
    } finally {
      // reset the input so the same file can be chosen again if needed
      e.target.value = "";
      setBusy(false);
    }
  }

  return (
    <>
      {/* Hidden input for web file choose */}
=======
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
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
<<<<<<< HEAD
        style={{ display: "none" }}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: busy ? "not-allowed" : "pointer",
          background: busy ? "#eee" : "#f7f7f7",
        }}
      >
        {busy ? "Uploading…" : label}
      </button>
    </>
  );
}
=======
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default WebPhotoPicker;
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
