import { useCallback, useEffect, useState } from 'react';

import type { AnalysisHistoryRecord, HistoryMap } from '../types';
import { appendHistoryEntry, loadHistory } from '../storage/history';

interface UseAnalysisHistoryResult {
  history: HistoryMap;
  record(entry: AnalysisHistoryRecord): Promise<void>;
  refresh(): Promise<void>;
}

export function useAnalysisHistory(): UseAnalysisHistoryResult {
  const [history, setHistory] = useState<HistoryMap>({});

  const refresh = useCallback(async () => {
    const next = await loadHistory();
    setHistory(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const record = useCallback(
    async (entry: AnalysisHistoryRecord) => {
      await appendHistoryEntry(entry);
      await refresh();
    },
    [refresh],
  );

  return { history, record, refresh };
}
