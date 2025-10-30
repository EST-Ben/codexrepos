import { useCallback, useEffect, useState } from 'react';

import { fetchMachines } from '../api/client';
import type { MachineSummary } from '../types';

export function useMachineRegistry() {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMachines();
      setMachines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { machines, loading, error, refresh: load };
}

export function filterMachines(machines: MachineSummary[], query: string): MachineSummary[] {
  if (!query.trim()) {
    return machines;
  }
  const lower = query.trim().toLowerCase();
  return machines.filter((machine) => {
    const brandModel = `${machine.brand ?? ''} ${machine.model ?? ''}`.toLowerCase();
    const aliasHit = (machine.aliases ?? []).some((alias) => alias.toLowerCase().includes(lower));
    return brandModel.includes(lower) || aliasHit || machine.id.toLowerCase().includes(lower);
  });
}
