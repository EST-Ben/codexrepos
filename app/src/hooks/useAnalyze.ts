// app/src/hooks/useAnalyze.ts
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { analyze, type RNFileLike } from "../api/client";
import type { AnalyzeRequestMeta, AnalyzeResponse } from "../types";

/** Variables accepted by the analyze mutation */
export type AnalyzeVars = {
  file: Blob | File | RNFileLike;
  meta: AnalyzeRequestMeta;
};

type AnalyzeError = Error;

export function useAnalyze() {
  const [progress, setProgress] = React.useState(0);
  const [queued, setQueued] = React.useState<AnalyzeVars[]>([]);

  const mutation = useMutation<AnalyzeResponse, AnalyzeError, AnalyzeVars>({
    mutationFn: async ({ file, meta }: AnalyzeVars) => {
      setProgress(0);
      // analyze() reports progress via the callback
      const res = await analyze(file, meta, (p) => setProgress(p));
      return res;
    },
    onError: (error: AnalyzeError, variables: AnalyzeVars) => {
      // Keep a simple retry queue on error
      setQueued((q) => [...q, variables]);
      // Optional: minimal console for debugging
      // eslint-disable-next-line no-console
      console.warn("analyze failed:", error?.message);
    },
    onSuccess: () => {
      setProgress(1);
    },
    onSettled: () => {
      // Ensure progress bar doesn’t get stuck if request short-circuits
      setProgress((p) => (p < 1 ? 1 : p));
    },
  });

  const retryQueued = React.useCallback(async () => {
    // Fire queued items sequentially to avoid burst uploads
    for (const item of queued) {
      await mutation.mutateAsync(item);
      setQueued((q) => q.slice(1));
    }
  }, [queued, mutation]);

  return {
    /** kick off an analysis */
    mutate: mutation.mutate,
    /** is a request in flight */
    isPending: mutation.isPending,
    /** did the last request succeed */
    isSuccess: mutation.isSuccess,
    /** latest successful response (or null) */
    data: mutation.data ?? null,
    /** reset mutation state */
    reset: mutation.reset,
    /** 0 → 1 progress (best-effort) */
    progress,
    /** number of queued retry requests */
    queuedCount: queued.length,
    /** retry any queued requests from failures */
    retryQueued,
  };
}
