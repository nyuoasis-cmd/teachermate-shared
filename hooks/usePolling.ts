import { useCallback, useEffect, useRef, useState } from 'react';

export type PollingStatus = 'idle' | 'polling' | 'complete' | 'error' | 'timeout';

export interface UsePollingOptions<T> {
  fetcher: (signal: AbortSignal) => Promise<T>;
  isComplete: (result: T) => boolean;
  intervalMs?: number;
  maxAttempts?: number;
  onError?: (err: Error) => void;
}

export interface UsePollingReturn<T> {
  data: T | null;
  status: PollingStatus;
  attempts: number;
  start: () => void;
  stop: () => void;
}

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 60;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Polling aborted', 'AbortError'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export function usePolling<T>({
  fetcher,
  isComplete,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  onError,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [attempts, setAttempts] = useState(0);
  const [runId, setRunId] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setAttempts(0);
    setStatus('polling');
    setRunId((current) => current + 1);
  }, []);

  useEffect(() => {
    if (status !== 'polling' || runId === 0) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      for (let nextAttempt = 1; nextAttempt <= maxAttempts; nextAttempt += 1) {
        const controller = new AbortController();
        controllerRef.current = controller;

        try {
          const result = await fetcher(controller.signal);
          if (cancelled || controller.signal.aborted) {
            return;
          }

          setData(result);
          setAttempts(nextAttempt);

          if (isComplete(result)) {
            setStatus('complete');
            controllerRef.current = null;
            return;
          }

          if (nextAttempt >= maxAttempts) {
            setStatus('timeout');
            controllerRef.current = null;
            return;
          }

          await wait(intervalMs, controller.signal);
        } catch (error) {
          if (controller.signal.aborted || cancelled) {
            return;
          }

          const normalizedError = error instanceof Error ? error : new Error('폴링 중 오류가 발생했어요.');
          setStatus('error');
          controllerRef.current = null;
          onError?.(normalizedError);
          return;
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [fetcher, intervalMs, isComplete, maxAttempts, onError, runId, status]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  return {
    data,
    status,
    attempts,
    start,
    stop,
  };
}
