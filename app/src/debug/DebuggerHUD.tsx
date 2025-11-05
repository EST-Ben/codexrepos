import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Log = { t: number; level: "log"|"warn"|"error"; msg: string };

const MAX_LOGS = 300;
const pretty = (x: unknown) => {
  try { return typeof x === "string" ? x : JSON.stringify(x, null, 2); }
  catch { return String(x); }
};

export const DebuggerHUD: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orig = { log: console.log, warn: console.warn, error: console.error };
    function push(level: Log["level"], ...args: any[]) {
      setLogs(prev => {
        const next = [{ t: Date.now(), level, msg: args.map(pretty).join(" ") }, ...prev];
        return next.slice(0, MAX_LOGS);
      });
      level === "error" ? orig.error(...args) : level === "warn" ? orig.warn(...args) : orig.log(...args);
    }
    console.log = (...a) => push("log", ...a);
    console.warn = (...a) => push("warn", ...a);
    console.error = (...a) => push("error", ...a);
    return () => { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; };
  }, []);

  useEffect(() => {
    Animated.timing(height, { toValue: open ? 260 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [open]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onLongPress={() => setOpen(o => !o)} style={styles.fab}>
        <Text style={styles.fabText}>{open ? "🛠" : "🛠"}</Text>
      </Pressable>
      <Animated.View style={[styles.panel, { height }]}>
        <View style={styles.bar}>
          <Text style={styles.title}>Debugger</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setLogs([])}><Text style={styles.clear}>Clear</Text></Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 8 }}>
          {logs.map((l, i) => (
            <Text key={i} style={[styles.line, l.level === "error" ? styles.err : l.level === "warn" ? styles.warn : null]}>
              {new Date(l.t).toLocaleTimeString()} · {l.level.toUpperCase()} · {l.msg}
            </Text>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: "#111827", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  fabText: { color: "#e2e8f0", fontWeight: "700" },
  panel: { position: "absolute", left: 8, right: 8, bottom: 60, backgroundColor: "#0b1220", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#1f2937" },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  title: { color: "#e2e8f0", fontWeight: "700" },
  clear: { color: "#38bdf8", fontWeight: "600" },
  scroll: { flex: 1 },
  line: { color: "#94a3b8", fontSize: 12, marginBottom: 4 },
  warn: { color: "#fbbf24" },
  err: { color: "#fca5a5" }
});
