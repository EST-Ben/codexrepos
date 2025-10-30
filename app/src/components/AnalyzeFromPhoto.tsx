// app/src/components/AnalyzeFromPhoto.tsx
import React, { useState } from "react";
import { View, Text, Button, Image, ActivityIndicator, TextInput, Platform, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { analyzeImage, AnalyzeImageResponse, Experience } from "../api/analyzeImage";

export default function AnalyzeFromPhoto() {
  const [uri, setUri] = useState<string | null>(null);
  const [machine, setMachine] = useState("bambu_x1c"); // put a real id from /api/machines
  const [material, setMaterial] = useState("PLA");
  const [experience, setExperience] = useState<Experience>("Intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeImageResponse | null>(null);

  async function pickImage() {
    setError(null);
    setResult(null);

    // Ask for gallery permission
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Permission to access photos was denied.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (!picked.canceled && picked.assets?.length) {
      setUri(picked.assets[0].uri);
    }
  }

  async function submit() {
    if (!uri) {
      setError("Please pick a photo first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeImage({
        uri,
        machine,
        material,
        experience,
        // Optional overrides:
        mimeType: Platform.OS === "ios" ? "image/heic" : "image/jpeg",
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Analyze Failed Print (Photo)</Text>

      <View style={{ gap: 6 }}>
        <Text>Machine (id from /api/machines)</Text>
        <TextInput
          value={machine}
          onChangeText={setMachine}
          placeholder="e.g. bambu_x1c"
          autoCapitalize="none"
          style={{
            padding: 10,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text>Material</Text>
        <TextInput
          value={material}
          onChangeText={setMaterial}
          placeholder="PLA"
          autoCapitalize="characters"
          style={{
            padding: 10,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text>Experience (Beginner | Intermediate | Advanced)</Text>
        <TextInput
          value={experience}
          onChangeText={(t) => setExperience((t as Experience) || "Intermediate")}
          placeholder="Intermediate"
          autoCapitalize="words"
          style={{
            padding: 10,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Pick Photo" onPress={pickImage} />
        <Button title="Analyze" onPress={submit} disabled={!uri || loading} />
      </View>

      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: 220, borderRadius: 12, marginTop: 8 }}
          resizeMode="cover"
        />
      ) : null}

      {loading ? (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
          <Text>Analyzing photo…</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: "crimson", marginTop: 8 }}>{error}</Text>
      ) : null}

      {result ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={{ fontWeight: "600" }}>Prediction</Text>
          <Text>Machine: {result.machine?.brand} {result.machine?.model} ({result.machine?.id})</Text>
          <Text>Issue: {result.issue}</Text>
          <Text>Confidence: {(result.confidence * 100).toFixed(1)}%</Text>

          <Text style={{ fontWeight: "600", marginTop: 8 }}>Recommendations</Text>
          {result.recommendations?.length
            ? result.recommendations.map((r, i) => <Text key={i}>• {r}</Text>)
            : <Text>None</Text>}

          <Text style={{ fontWeight: "600", marginTop: 8 }}>Parameter Targets</Text>
          {Object.entries(result.parameter_targets || {}).map(([k, v]) => (
            <Text key={k}>{k}: {v}</Text>
          ))}

          <Text style={{ fontWeight: "600", marginTop: 8 }}>Applied (clamped)</Text>
          {Object.entries(result.applied || {}).map(([k, v]) => (
            <Text key={k}>{k}: {v}</Text>
          ))}

          {result.capability_notes?.length ? (
            <>
              <Text style={{ fontWeight: "600", marginTop: 8 }}>Notes</Text>
              {result.capability_notes.map((n, i) => <Text key={i}>• {n}</Text>)}
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
