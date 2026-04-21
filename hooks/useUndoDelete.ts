import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { showToast } from '../components/ToastContainer';

type AnalyticsEvent = 'requested' | 'confirmed' | 'undone' | 'expired' | 'undo-failed';

interface RealtimeChannelOptions<T> {
  supabase: SupabaseClient;
  table: string;
  filter?: string;
  onExternalDelete?: (item: T) => void;
  onExternalRestore?: (item: T) => void;
}

export interface UseUndoDeleteOptions<T> {
  onDelete: (item: T) => Promise<void>;
  onUndo: (item: T) => Promise<void>;
  confirmTitle: (item: T) => string;
  confirmDescription?: (item: T) => string;
  toastMessage?: (item: T) => string;
  duration?: number;
  onAnalytics?: (event: AnalyticsEvent, item: T) => void;
  realtimeChannel?: RealtimeChannelOptions<T>;
  onUndoError?: (error: Error, item: T) => void;
  maxUndoRetries?: number;
  ownershipCheck?: (item: T) => Promise<boolean>;
  ownershipErrorMessage?: string;
  autoConfirmPreviousOnNewDelete?: boolean;
}

export interface UseUndoDeleteReturn<T> {
  currentTarget: T | null;
  isModalOpen: boolean;
  isConfirming: boolean;
  isToastVisible: boolean;
  modalProps: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: string;
    loading: boolean;
    variant: 'destructive';
  };
  toastProps: {
    message: string;
    onUndo: () => void | Promise<void>;
    onExpire: () => void;
    duration: number;
  };
  request: (item: T) => void;
  cancel: () => void;
}

export function useUndoDelete<T>(options: UseUndoDeleteOptions<T>): UseUndoDeleteReturn<T> {
  const {
    onDelete,
    onUndo,
    confirmTitle,
    confirmDescription,
    toastMessage,
    duration = 10000,
    onAnalytics,
    realtimeChannel,
    onUndoError,
    maxUndoRetries = 3,
    ownershipCheck,
    ownershipErrorMessage = '이 기기에서 만든 항목만 삭제할 수 있어요',
    autoConfirmPreviousOnNewDelete = true,
  } = options;

  const [currentTarget, setCurrentTarget] = useState<T | null>(null);
  const [toastTarget, setToastTarget] = useState<T | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [undoRetryCount, setUndoRetryCount] = useState(0);
  const latestToastTargetRef = useRef<T | null>(null);

  useEffect(() => {
    latestToastTargetRef.current = toastTarget;
  }, [toastTarget]);

  const closeToast = useCallback(() => {
    setIsToastVisible(false);
    setToastTarget(null);
    setUndoRetryCount(0);
  }, []);

  const expireToast = useCallback(() => {
    const target = latestToastTargetRef.current;
    if (!target) {
      closeToast();
      return;
    }

    onAnalytics?.('expired', target);
    closeToast();
    setCurrentTarget((previous) => (previous === target ? null : previous));
  }, [closeToast, onAnalytics]);

  const cancel = useCallback(() => {
    if (isConfirming) {
      return;
    }
    setIsModalOpen(false);
  }, [isConfirming]);

  const handleUndo = useCallback(async () => {
    const target = latestToastTargetRef.current;
    if (!target) {
      closeToast();
      return;
    }

    try {
      await onUndo(target);
      onAnalytics?.('undone', target);
      closeToast();
      setCurrentTarget((previous) => (previous === target ? null : previous));
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('실행 취소에 실패했어요.');
      const nextRetryCount = undoRetryCount + 1;
      setUndoRetryCount(nextRetryCount);
      onUndoError?.(normalizedError, target);
      onAnalytics?.('undo-failed', target);

      if (nextRetryCount >= maxUndoRetries) {
        closeToast();
        showToast(normalizedError.message || '실행 취소에 실패했어요.', 'error');
      }

      throw normalizedError;
    }
  }, [closeToast, maxUndoRetries, onAnalytics, onUndo, onUndoError, undoRetryCount]);

  const confirmDelete = useCallback(async () => {
    if (!currentTarget || isConfirming) {
      return;
    }

    setIsConfirming(true);

    try {
      await onDelete(currentTarget);
      onAnalytics?.('confirmed', currentTarget);
      setIsModalOpen(false);
      setToastTarget(currentTarget);
      latestToastTargetRef.current = currentTarget;
      setIsToastVisible(true);
      setUndoRetryCount(0);
    } finally {
      setIsConfirming(false);
    }
  }, [currentTarget, isConfirming, onAnalytics, onDelete]);

  const request = useCallback(
    (item: T) => {
      void (async () => {
        if (ownershipCheck) {
          const canDelete = await ownershipCheck(item);
          if (!canDelete) {
            showToast(ownershipErrorMessage, 'error');
            return;
          }
        }

        if (autoConfirmPreviousOnNewDelete && isToastVisible) {
          expireToast();
        }

        setCurrentTarget(item);
        setIsModalOpen(true);
        onAnalytics?.('requested', item);
      })();
    },
    [autoConfirmPreviousOnNewDelete, expireToast, isToastVisible, onAnalytics, ownershipCheck, ownershipErrorMessage],
  );

  useEffect(() => {
    if (!realtimeChannel) {
      return;
    }

    const { supabase, table, filter, onExternalDelete, onExternalRestore } = realtimeChannel;
    const channel = supabase
      .channel(`shared-undo-delete:${table}:${filter ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter,
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const previousDeletedAt = payload.old.deleted_at;
          const nextDeletedAt = payload.new.deleted_at;

          if (!previousDeletedAt && nextDeletedAt) {
            onExternalDelete?.(payload.new as unknown as T);
          }

          if (previousDeletedAt && !nextDeletedAt) {
            onExternalRestore?.(payload.new as unknown as T);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [realtimeChannel]);

  const modalProps = useMemo(
    () => ({
      open: isModalOpen,
      onClose: cancel,
      onConfirm: confirmDelete,
      title: currentTarget ? confirmTitle(currentTarget) : '',
      description: currentTarget ? confirmDescription?.(currentTarget) : undefined,
      loading: isConfirming,
      variant: 'destructive' as const,
    }),
    [cancel, confirmDelete, confirmDescription, confirmTitle, currentTarget, isConfirming, isModalOpen],
  );

  const toastProps = useMemo(
    () => ({
      message: toastTarget ? toastMessage?.(toastTarget) ?? '삭제했어요' : '',
      onUndo: handleUndo,
      onExpire: expireToast,
      duration,
    }),
    [duration, expireToast, handleUndo, toastMessage, toastTarget],
  );

  return {
    currentTarget,
    isModalOpen,
    isConfirming,
    isToastVisible,
    modalProps,
    toastProps,
    request,
    cancel,
  };
}
