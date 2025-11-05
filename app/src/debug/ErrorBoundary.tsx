import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state = { err: undefined as Error | undefined };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.msg}>{String(this.state.err?.message || this.state.err)}</Text>
        <Pressable onPress={() => this.setState({ err: undefined })}><Text style={styles.btn}>Try again</Text></Pressable>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0b1220" },
  title: { color: "#e2e8f0", fontWeight: "700", fontSize: 18 },
  msg: { color: "#94a3b8", textAlign: "center", marginVertical: 12 },
  btn: { color: "#38bdf8", fontWeight: "700" }
});
