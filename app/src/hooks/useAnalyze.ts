import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { analyze } from '../api/client';
import type { AnalyzeRequestMeta, AnalyzeResponse, MachineRef } from '../types';
import {
  enqueueAnalysis,
  listQueuedAnalyses,
  removeQueuedAnalysis,
  type QueuedAnalysisItem,
} from '../storage/queue';

interface AnalyzeVariables {
  file: Blob | { uri: string; name: string; type: string };
  meta: AnalyzeRequestMeta;
  machine?: MachineRef;
  material?: string;
}

interface AnalyzeMutationContext {
  onProgress?: (progress: number) => void;
}

interface UseAnalyzeOptions {
  onQueueSuccess?(item: QueuedAnalysisItem, response: AnalyzeResponse): void;
}

export function useAnalyze(options?: UseAnalyzeOptions) {
  const [progress, setProgress] = useState<number>(0);
  const [queued, setQueued] = useState<QueuedAnalysisItem[]>([]);
  const processingQueue = useRef<boolean>(false);

  const refreshQueue = useCallback(async () => {
    const items = await listQueuedAnalyses();
    setQueued(items);
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const mutation = useMutation<AnalyzeResponse, Error, AnalyzeVariables, AnalyzeMutationContext>({
    mutationFn: async ({ file, meta }) =>
      analyze(file, meta, (value) => {
        setProgress(value);
      }),
    onError: async (error, variables) => {
      const message = error?.message?.toLowerCase() ?? '';
      const isNetworkIssue = message.includes('network') || message.includes('timeout') || message.includes('fetch');
      if (isNetworkIssue && variables.file && typeof (variables.file as any).uri === 'string' && variables.machine) {
        const queuedItem = await enqueueAnalysis({
          fileUri: (variables.file as any).uri,
          fileName: (variables.file as any).name ?? 'upload.jpg',
          fileType: (variables.file as any).type ?? 'image/jpeg',
          meta: variables.meta,
          machine: variables.machine,
          material: variables.material,
        });
        await refreshQueue();
        Alert.alert(
          'Saved for later',
          'You appear to be offline. The photo was saved and will retry automatically when a connection is available.',
        );
        console.warn('Queued analysis due to network issue', queuedItem.id);
      } else {
        Alert.alert('Upload failed', error.message || 'Unable to analyze the photo. Please try again.');
      }
    },
    onSettled: () => {
      setProgress(0);
    },
  });

  const processQueue = useCallback(async () => {
    if (processingQueue.current) {
      return;
    }
    processingQueue.current = true;
    try {
      let items = await listQueuedAnalyses();
      for (const item of items) {
        try {
          const response = await analyze(
            { uri: item.fileUri, name: item.fileName, type: item.fileType },
            item.meta,
          );
          await removeQueuedAnalysis(item.id);
          options?.onQueueSuccess?.(item, response);
        } catch (err) {
          console.warn('Failed to process queued analysis', err);
          break;
        }
      }
    } finally {
      processingQueue.current = false;
      await refreshQueue();
    }
  }, [options, refreshQueue]);

  const mutateWithProgress = useCallback(
    (
      variables: AnalyzeVariables,
      context?: AnalyzeMutationContext,
    ) => {
      mutation.mutate(variables, {
        context,
      });
    },
    [mutation],
  );

  return {
    mutate: mutateWithProgress,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    data: mutation.data,
    reset: mutation.reset,
    progress,
    queuedCount: queued.length,
    retryQueued: processQueue,
  };
}
