import { useCallback } from 'react';
import type { AnalysisHistoryRecord } from '../types';
import { appendHistory, loadHistory } from '../storage/history';

export function useAnalysisHistory() {
  const add = useCallback(async (entry: AnalysisHistoryRecord) => {
    await appendHistory(entry);
  }, []);

  const load = useCallback(async () => {
    return loadHistory();
  }, []);

  return { add, load };
}
