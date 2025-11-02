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
  machineId,
  material,
  experience,
  onResult,
  onError,
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
