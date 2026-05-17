import { useEffect, useState } from 'react';

export interface UndoToastProps {
  message: string;
  undoLabel?: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
  onExpire?: () => void;
}

export function UndoToast({
  message,
  undoLabel = '실행 취소',
  duration = 10000,
  onUndo,
  onExpire,
}: UndoToastProps) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [hasUndoError, setHasUndoError] = useState(false);

  useEffect(() => {
    if (isUndoing) {
      return;
    }

    const timer = window.setTimeout(() => {
      onExpire?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, isUndoing, onExpire]);

  const handleUndo = async () => {
    if (isUndoing) {
      return;
    }

    try {
      setIsUndoing(true);
      setHasUndoError(false);
      await onUndo();
    } catch {
      setHasUndoError(true);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex min-w-[280px] max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-white shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{message}</p>
        {hasUndoError ? <p className="mt-1 text-xs text-red-200">실행 취소에 실패했어요. 다시 시도해주세요.</p> : null}
      </div>
      <button
        type="button"
        onClick={handleUndo}
        disabled={isUndoing}
        className="shrink-0 rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUndoing ? '처리 중' : hasUndoError ? '다시 시도' : undoLabel}
      </button>
    </div>
  );
}
