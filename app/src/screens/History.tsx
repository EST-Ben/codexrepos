<<<<<<< HEAD
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
=======
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1

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

<<<<<<< HEAD
export const History: React.FC<HistoryProps> = ({ machine, onSelect, onClose }) => {
  const { historyByMachine } = useAnalysisHistory();
=======
export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  machines,
  history,
  initialMachineId,
  onClose,
  onSelect,
}) => {
  const machineIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(history).forEach((id) => ids.add(id));
    machines.forEach((machine) => ids.add(machine.id));
    return Array.from(ids);
  }, [history, machines]);
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1

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

<<<<<<< HEAD
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
=======
      {machineIds.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {machineIds.map((id) => {
            const machine = machines.find((item) => item.id === id);
            const label = machine ? `${machine.brand} ${machine.model}` : id;
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
                <Text style={styles.cardSummary}>{formatIssues(entry.issues)}</Text>
                <Text style={styles.cardFooter}>Image ID: {entry.imageId}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
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
<<<<<<< HEAD
    backgroundColor: '#1f2937',
=======
    backgroundColor: '#111c2c',
    padding: 20,
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
    borderRadius: 12,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
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
<<<<<<< HEAD
    alignItems: 'baseline',
=======
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
  },
  cardTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  cardMeta: {
    color: '#94a3b8',
  },
  cardSummary: {
<<<<<<< HEAD
    color: '#e2e8f0',
=======
    color: '#cbd5f5',
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
  },
  cardFooter: {
    color: '#64748b',
    fontSize: 12,
  },
});

<<<<<<< HEAD
export default History;
=======
export default HistoryScreen;
>>>>>>> dc18027a43493057f17ef6cef96318a53002a2f1
