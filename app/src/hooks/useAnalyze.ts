import { useCallback, useMemo, useState } from 'react';
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
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

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
      setError(null);
      setStatus('uploading');
      setProgress(0);
      try {
        const res = await analyzeImageClient(file as any, meta, (p: number) => {
          setProgress(typeof p === 'number' ? p : 0);
        });
        setData(res);
        setIsSuccess(true);
        setStatus('success');
        return res;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        setStatus('error');
        throw wrapped;
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
    setError(null);
    setStatus('idle');
  }, []);

  // keep placeholders for API compatibility with tests
  const queuedCount = 0;
  const retryQueued = () => {};

  const analyzeImage = useCallback(
    async (file: LocalFile, meta: AnalyzeRequestMeta) => mutate({ file, meta }),
    [mutate]
  );

  const normalizedProgress = useMemo(() => {
    if (progress > 1) {
      return Math.min(progress, 100);
    }
    return Math.max(0, Math.round(progress * 100));
  }, [progress]);

  return {
    mutate,
    analyzeImage,
    isPending,
    isSuccess,
    data,
    reset,
    progress: normalizedProgress,
    status,
    error,
    queuedCount,
    retryQueued,
  };
}
