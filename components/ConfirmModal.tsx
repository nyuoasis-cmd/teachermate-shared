import { useEffect, useMemo, useRef, useState } from 'react';
import { useBackClosable } from '../hooks/useBackClosable';

/**
 * ConfirmModal — §9.H-4 single-primary-confirm modal 계약 구현체.
 *
 * §9.H-4 / §9.H-8 정렬 (검증 2026-05-16):
 * - ESC: 닫기 (loading 중 잠금) ✓
 * - destructive variant: confirm 버튼 autoFocus 없음 → Enter 자동 발화 ❌ (정책 합규) ✓
 * - backdrop click: 닫기 (loading 중 잠금) ✓
 * - body scroll lock: open 동안 hidden ✓
 * - 뒤로가기: 창만 닫힌다(§9.H-18 v2.4). 처리 중에 누르면 창은 그대로 두고, 처리가 끝나 창이 아직 열려 있으면
 *   뒤로가기 보호를 다시 건다.
 * - 확인 뒤 다른 화면으로 이동하는 창은 `confirmNavigates` 를 켠다 — 창 칸을 먼저 치운 **뒤에** onConfirm 을 부른다
 *   (안 켜면 이동한 화면에서 뒤로가기를 두 번 눌러야 한다). 기본은 예전처럼 누르는 즉시 onConfirm.
 *
 * 외부 surface가 §9.H-3·9.H-8 destructive Enter 금지를 만족하려면 ConfirmModal을 사용하라.
 * 인라인 confirm 모달은 §9.H-4 destructive 계약 미흡 (ESC 누락 빈번).
 */
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'primary';
  loading?: boolean;
  /**
   * 뒤로가기로 이 창만 닫기(기본 켬). 🚨 useExitGuard 의 나가기 확인창처럼 **뒤로가기가 연 창**은 끈다
   * (ExitGuardModal 은 이미 끈다).
   */
  closeOnBack?: boolean;
  /** onConfirm 이 다른 화면으로 이동한다 — 창 칸을 먼저 치운 뒤에 onConfirm 을 부른다(closeThen). */
  confirmNavigates?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  variant = 'destructive',
  loading,
  closeOnBack = true,
  confirmNavigates = false,
}: ConfirmModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading ?? internalLoading;
  // 확인을 누른 뒤 끝날 때까지 — 바깥 loading 값과 상관없이 버튼을 잠근다(칸 치우기를 기다리는 동안 포함).
  const [busy, setBusy] = useState(false);
  const isLocked = isLoading || busy;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  // 뒤로가기가 칸을 가져갔는데 창은 안 닫혔다(처리 중) — 끝나면 다시 건다.
  const [disarmed, setDisarmed] = useState(false);
  const win = useBackClosable(open && closeOnBack && !disarmed, () => {
    if (isLockedRef.current) setDisarmed(true);
    else onClose();
  });

  useEffect(() => {
    if (open && disarmed && !isLocked) setDisarmed(false);
  }, [open, disarmed, isLocked]);

  useEffect(() => {
    if (!open) {
      setInternalLoading(false);
      setBusy(false);
      setDisarmed(false);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLocked) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, onClose, open]);

  const confirmClassName = useMemo(() => {
    const base =
      'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60';
    return variant === 'destructive' ? `${base} bg-red-600 hover:bg-red-700` : `${base} bg-stone-900 hover:bg-stone-800`;
  }, [variant]);

  if (!open) {
    return null;
  }

  const runConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
      onClose();
    } finally {
      setInternalLoading(false);
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (isLocked) {
      return;
    }
    setBusy(true);
    if (!confirmNavigates) {
      void runConfirm();
      return;
    }
    // 창 칸을 먼저 치운다 — onConfirm 이 navigate 해도 죽은 기록 칸이 남지 않는다(closeThen).
    // 칸은 이미 치워졌으니 처리 중 다시 걸지 않는다(disarmed) — 실패해 창이 남으면 끝난 뒤 다시 건다.
    win.closeThen(() => {
      setDisarmed(true);
      void runConfirm();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
      onClick={() => {
        if (!isLocked) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-[400px] rounded-t-2xl rounded-b-none bg-white px-6 pt-6 shadow-lg md:w-[90%] md:rounded-xl"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          disabled={isLocked}
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="pr-8 text-[17px] font-semibold text-stone-900">{title}</h3>
        {description ? <p className="mt-1.5 text-sm text-stone-500">{description}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={isLocked}
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button type="button" disabled={isLocked} onClick={handleConfirm} className={confirmClassName}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                처리 중
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
