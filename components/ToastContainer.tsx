import { useCallback, useEffect, useState } from 'react';
import { UndoToast, type UndoToastProps } from './UndoToast';

type BasicToastType = 'success' | 'error';

export interface BasicToastOptions {
  type?: BasicToastType;
  duration?: number;
}

export interface UndoToastOptions extends Omit<UndoToastProps, 'message'> {
  type: 'undo';
}

export type ShowToastOptions = BasicToastOptions | UndoToastOptions | BasicToastType;

type ToastRecord =
  | {
      id: number;
      kind: 'basic';
      message: string;
      type: BasicToastType;
      duration: number;
    }
  | {
      id: number;
      kind: 'undo';
      message: string;
      undoLabel?: string;
      duration: number;
      onUndo: () => void | Promise<void>;
      onExpire?: () => void;
    };

let toastId = 0;
let toastListener: ((toast: ToastRecord) => void) | null = null;

export function showToast(message: string, options: ShowToastOptions = { type: 'success' }): number {
  const nextId = ++toastId;
  const normalized = normalizeToast(nextId, message, options);
  toastListener?.(normalized);
  return nextId;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    toastListener = (toast) => {
      setToasts((current) => {
        const next = [...current, toast];
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
    };

    return () => {
      toastListener = null;
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed left-1/2 z-[60] flex -translate-x-1/2 flex-col-reverse items-center gap-3"
      style={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      {toasts.map((toast) =>
        toast.kind === 'undo' ? (
          <UndoToast
            key={toast.id}
            message={toast.message}
            undoLabel={toast.undoLabel}
            duration={toast.duration}
            onUndo={async () => {
              await toast.onUndo();
              dismissToast(toast.id);
            }}
            onExpire={() => {
              toast.onExpire?.();
              dismissToast(toast.id);
            }}
          />
        ) : (
          <BasicToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onExpire={() => dismissToast(toast.id)}
          />
        ),
      )}
    </div>
  );
}

interface BasicToastProps {
  message: string;
  type: BasicToastType;
  duration: number;
  onExpire: () => void;
}

function BasicToast({ message, type, duration, onExpire }: BasicToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onExpire, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onExpire]);

  return (
    <div
      className={`flex min-w-[220px] max-w-[calc(100vw-32px)] items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
        type === 'error' ? 'bg-red-600' : 'bg-stone-900'
      }`}
    >
      {type === 'error' ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span className="truncate">{message}</span>
    </div>
  );
}

function normalizeToast(id: number, message: string, options: ShowToastOptions): ToastRecord {
  if (typeof options === 'string') {
    return {
      id,
      kind: 'basic',
      message,
      type: options,
      duration: 3000,
    };
  }

  if ('type' in options && options.type === 'undo') {
    return {
      id,
      kind: 'undo',
      message,
      undoLabel: options.undoLabel,
      duration: options.duration ?? 10000,
      onUndo: options.onUndo,
      onExpire: options.onExpire,
    };
  }

  return {
    id,
    kind: 'basic',
    message,
    type: options.type ?? 'success',
    duration: options.duration ?? 3000,
  };
}
