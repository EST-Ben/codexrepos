import { useEffect, useState, useCallback } from 'react';
import type { MachineSummary } from '../types';
import * as client from '../api/client';

export function useMachineRegistry() {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer client.fetchMachines if available, else fallback to a minimal list
      let list: MachineSummary[];
      if (typeof (client as any).fetchMachines === 'function') {
        list = await (client as any).fetchMachines();
      } else {
        // Fallback single entry to keep screens working during dev
        list = [
          {
            id: 'bambu_p1s',
            brand: 'Bambu Lab',
            model: 'P1S',
            max_nozzle_temp_c: 300,
            safe_speed_ranges: { print: [40, 300] },
          } as MachineSummary,
        ];
      }
      setMachines(list);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { machines, loading, error, refresh: fetchList };
}

// Pass-thru utility (tests sometimes import it)
export function filterMachines(machines: MachineSummary[]) {
  return machines;
}
