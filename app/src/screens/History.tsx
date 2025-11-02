import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AnalysisHistoryRecord, HistoryMap, MachineRef } from '../types';

interface HistoryScreenProps {
  machines: MachineRef[];
  history: HistoryMap;
  initialMachineId?: string | null;
  onClose(): void;
  onSelect(entry: AnalysisHistoryRecord): void;
}

function formatTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) {
    return 'Just now';
  }
  if (diff < hour) {
    const minutes = Math.round(diff / minute);
    return `${minutes} min ago`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(diff / day);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatIssues(issues: AnalysisHistoryRecord['issues']): string {
  if (!issues?.length) {
    return 'No issues logged';
  }
  const top = issues.slice(0, 3);
  return top
    .map((item) => `${item.id} (${Math.round(item.confidence * 100)}%)`)
    .join(' • ');
}

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

  const [activeMachineId, setActiveMachineId] = useState<string | null>(initialMachineId ?? machineIds[0] ?? null);

  useEffect(() => {
    if (!activeMachineId || !machineIds.includes(activeMachineId)) {
      setActiveMachineId(machineIds[0] ?? null);
    }
  }, [activeMachineId, machineIds]);

  useEffect(() => {
    if (initialMachineId && machineIds.includes(initialMachineId)) {
      setActiveMachineId(initialMachineId);
    }
  }, [initialMachineId, machineIds]);

  const entries = activeMachineId ? history[activeMachineId] ?? [] : [];
  const activeMachine = machines.find((machine) => machine.id === activeMachineId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analysis history</Text>
        <Pressable onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Back</Text>
        </Pressable>
      </View>

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
  tabBar: {
    flexGrow: 0,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#38bdf8',
  },
  tabLabel: {
    color: '#e2e8f0',
  },
  tabLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  details: {
    flex: 1,
    gap: 12,
  },
  machineHeading: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#111c2c',
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#94a3b8',
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: '#111c2c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  cardMeta: {
    color: '#94a3b8',
  },
  cardSummary: {
    color: '#cbd5f5',
  },
  cardFooter: {
    color: '#64748b',
    fontSize: 12,
  },
});

export default HistoryScreen;
