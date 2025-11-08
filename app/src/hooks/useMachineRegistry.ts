import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMachineSummaries } from '../api/client';
import type { MachineSummary } from '../types';

export type Machine = MachineSummary;
export type MachineId = MachineSummary['id'];

const PREFERRED_DEFAULT_ID: MachineId = 'bambu_p1s';

type MachineRegistryState = {
  all: MachineSummary[];
  ids: MachineId[];
  byId(id: MachineId): MachineSummary | undefined;
  defaultId: MachineId | null;
  loading: boolean;
  error: Error | null;
  refresh(): Promise<void>;
};

export function useMachineRegistry(): MachineRegistryState {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMachines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMachineSummaries();
      if (!isMountedRef.current) return;
      setMachines(payload);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMachines();
  }, [loadMachines]);

  const ids = useMemo<MachineId[]>(() => machines.map((machine) => machine.id), [machines]);

  const machineMap = useMemo(() => {
    const map = new Map<MachineId, MachineSummary>();
    for (const machine of machines) {
      map.set(machine.id, machine);
    }
    return map;
  }, [machines]);

  const byId = useCallback<MachineRegistryState['byId']>(
    (id) => machineMap.get(id),
    [machineMap]
  );

  const defaultId = useMemo<MachineId | null>(() => {
    if (machineMap.has(PREFERRED_DEFAULT_ID)) {
      return PREFERRED_DEFAULT_ID;
    }
    return ids[0] ?? null;
  }, [ids, machineMap]);

  return {
    all: machines,
    ids,
    byId,
    defaultId,
    loading,
    error,
    refresh: loadMachines,
  };
}

export default useMachineRegistry;
