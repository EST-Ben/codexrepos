// app/src/screens/History.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AnalysisHistoryRecord, MachineRef, AnalyzeResponse } from '../types';

interface HistoryProps {
  machines: MachineRef[];
  /** Map of machineId -> list of history entries */
  history: Record<string, AnalysisHistoryRecord[]>;
  initialMachineId?: string | null;
  onSelect(entry: AnalysisHistoryRecord): void;
  onClose(): void;
}

function formatTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return `${ts}`;
  }
}

/** Prefer a declared top_issue; otherwise show top 3 predictions by confidence. */
function formatPredictions(resp: AnalyzeResponse | undefined): string {
  if (!resp) return 'No predictions';
  const anyResp = resp as any;

  const preds = Array.isArray(resp.predictions) ? resp.predictions : [];
  const top: string | undefined = anyResp.top_issue;

  if (top) {
    const topConf = preds.find((p) => p.issue_id === top)?.confidence;
    return `Top: ${top}${typeof topConf === 'number' ? ` (${Math.round(topConf * 100)}%)` : ''}`;
  }

  if (!preds.length) return 'No predictions';

  const top3 = [...preds]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3)
    .map((p) => `${p.issue_id} (${Math.round((p.confidence ?? 0) * 100)}%)`);

  return top3.join(' · ');
}

const HistoryScreen: React.FC<HistoryProps> = ({
  machines,
  history,
  initialMachineId = null,
  onClose,
  onSelect,
}) => {
  const allMachineIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(history).forEach((id) => ids.add(id));
    machines.forEach((m) => ids.add(m.id));
    return Array.from(ids);
  }, [history, machines]);

  const [activeMachineId, setActiveMachineId] = useState<string | null>(
    initialMachineId ?? machines[0]?.id ?? allMachineIds[0] ?? null
  );

  const activeMachine = useMemo(
    () => (activeMachineId ? machines.find((m) => m.id === activeMachineId) ?? null : null),
    [machines, activeMachineId]
  );

  const entries: AnalysisHistoryRecord[] = useMemo(() => {
    const list = activeMachineId ? history[activeMachineId] ?? [] : [];
    return list.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [activeMachineId, history]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          History{activeMachine ? ` · ${activeMachine.brand} ${activeMachine.model}` : ''}
        </Text>
        <Pressable onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Close</Text>
        </Pressable>
      </View>

      {/* Machine Tabs */}
      {allMachineIds.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {allMachineIds.map((id) => {
            const m = machines.find((item) => item.id === id);
            const label = m ? `${m.brand} ${m.model}` : id;
            const active = id === activeMachineId;
            return (
              <Pressable
                key={id}
                onPress={() => setActiveMachineId(id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Details / List */}
      <View style={styles.details}>
        {activeMachine ? (
          <Text style={styles.machineHeading}>
            {activeMachine.brand} {activeMachine.model}
          </Text>
        ) : null}

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No analyses yet.</Text>
            <Text style={styles.emptySubtitle}>
              Once you upload photos, they will appear here even if you go offline.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list}>
            {entries.map((entry) => (
              <Pressable key={entry.imageId} style={styles.card} onPress={() => onSelect(entry)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{formatTimestamp(entry.timestamp)}</Text>
                  <Text style={styles.cardMeta}>{entry.material ?? 'Material unknown'}</Text>
                </View>
                <Text style={styles.cardSummary}>{formatPredictions(entry.response)}</Text>
                <Text style={styles.cardFooter}>Image ID: {entry.imageId}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryLabel: { color: '#e2e8f0', fontWeight: '500' },

  // Tabs
  tabBar: { marginBottom: 12 },
  tab: {
    backgroundColor: '#0b1222',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
  },
  tabActive: { backgroundColor: '#1f2937', borderColor: '#334155' },
  tabLabel: { color: '#cbd5f5' },
  tabLabelActive: { color: '#f8fafc', fontWeight: '600' },

  // Details + list
  details: { flex: 1, gap: 12 },
  machineHeading: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginBottom: 4 },

  emptyState: { backgroundColor: '#111c2c', padding: 20, borderRadius: 12, gap: 8 },
  emptyTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: '#cbd5f5' },

  list: { flex: 1 },

  card: { backgroundColor: '#111c2c', borderRadius: 12, padding: 12, marginBottom: 12, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  cardMeta: { color: '#94a3b8' },
  cardSummary: { color: '#cbd5f5' },
  cardFooter: { color: '#64748b', fontSize: 12 },
});

export default HistoryScreen;
