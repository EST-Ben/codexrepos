import { useCallback, useState } from 'react';
import type { AnalyzeRequestMeta, AnalyzeResponse } from '../types';
import { analyzeImage as analyzeImageClient } from '../api/client';

// Local file union; avoids importing a non-exported RNFileLike
export type LocalFile =
  | { uri: string; name?: string; type?: string }
  | File
  | Blob;

export function useAnalyze() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [progress, setProgress] = useState(0);

  const mutate = useCallback(
    async ({
      file,
      meta,
    }: {
      file: LocalFile;
      meta: AnalyzeRequestMeta;
    }) => {
      setIsPending(true);
      setIsSuccess(false);
      setData(null);
      try {
        const res = await analyzeImageClient(file as any, meta, (p: number) => setProgress(p));
        setData(res);
        setIsSuccess(true);
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setData(null);
    setProgress(0);
  }, []);

  // keep placeholders for API compatibility with tests
  const queuedCount = 0;
  const retryQueued = () => {};

  return { mutate, isPending, isSuccess, data, reset, progress, queuedCount, retryQueued };
}
