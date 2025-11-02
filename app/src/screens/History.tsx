import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAnalysisHistory } from '../state/useAnalysisHistory';
import type { AnalysisHistoryRecord, MachineRef, AnalyzeResponse } from '../types';

interface HistoryProps {
  machine?: MachineRef | null;
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

/** Format summary from the new response shape (predictions). */
function formatPredictions(resp: AnalyzeResponse | undefined): string {
  if (!resp) return 'No predictions';
  // Prefer top_issue if present, else first few predictions by confidence
  const top = resp.top_issue;
  const preds = resp.predictions ?? [];
  if (top) {
    const topConf = preds.find(p => p.issue_id === top)?.confidence;
    return `Top: ${top}${typeof topConf === 'number' ? ` (${Math.round(topConf * 100)}%)` : ''}`;
  }
  if (!preds.length) return 'No predictions';
  const top3 = [...preds]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3)
    .map(p => `${p.issue_id} (${Math.round((p.confidence ?? 0) * 100)}%)`);
  return top3.join(' · ');
}

export const History: React.FC<HistoryProps> = ({ machine, onSelect, onClose }) => {
  const { historyByMachine } = useAnalysisHistory();

  const activeMachineId = machine?.id ?? null;

  const entries: AnalysisHistoryRecord[] = useMemo(() => {
    const list = activeMachineId ? historyByMachine[activeMachineId] ?? [] : [];
    return list.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [activeMachineId, historyByMachine]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          History{machine ? ` · ${machine.brand} ${machine.model}` : ''}
        </Text>
        <Pressable onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Close</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtitle}>
            Once you upload photos, they will appear here even if you go offline.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {entries.map((entry: AnalysisHistoryRecord) => (
            <Pressable
              key={entry.imageId}
              style={styles.card}
              onPress={() => onSelect(entry)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{formatTimestamp(entry.timestamp)}</Text>
                <Text style={styles.cardMeta}>{entry.material ?? 'Material unknown'}</Text>
              </View>

              {/* Summary line based on new response shape */}
              <Text style={styles.cardSummary}>{formatPredictions(entry.response as AnalyzeResponse)}</Text>

              <Text style={styles.cardFooter}>Image ID: {entry.imageId}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryLabel: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#cbd5f5',
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: '#111c2c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  cardMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cardSummary: {
    color: '#e2e8f0',
  },
  cardFooter: {
    color: '#64748b',
    fontSize: 12,
  },
});

export default History;
