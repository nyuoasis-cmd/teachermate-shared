import { useEffect, type CSSProperties } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  position?: 'fixed' | 'inline';
  placement?: 'top-right' | 'bottom-right';
  errorMessage?: string;
  savedDuration?: number;
  onAutoHide?: () => void;
}

export function AutosaveIndicator({
  status,
  position = 'fixed',
  placement = 'bottom-right',
  errorMessage = '저장 실패',
  savedDuration = 1500,
  onAutoHide,
}: AutosaveIndicatorProps) {
  useEffect(() => {
    if (status !== 'saved' || !onAutoHide) return;
    const timer = window.setTimeout(onAutoHide, savedDuration);
    return () => window.clearTimeout(timer);
  }, [status, savedDuration, onAutoHide]);

  if (status === 'idle') return null;

  const message =
    status === 'saving'
      ? '저장 중…'
      : status === 'saved'
        ? '저장됨'
        : errorMessage;

  const color =
    status === 'error'
      ? 'var(--color-danger-fg, #b91c1c)'
      : 'var(--color-text-muted, #78716c)';

  const baseStyle: CSSProperties = {
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    color,
    background: 'var(--color-surface, #ffffff)',
    border: `1px solid ${status === 'error' ? 'var(--color-danger-border, #fecaca)' : 'var(--color-border, #e7e5e4)'}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    pointerEvents: 'none',
    wordBreak: 'keep-all',
    transition: 'opacity 150ms cubic-bezier(.2,.8,.2,1)',
  };

  const style: CSSProperties =
    position === 'fixed'
      ? {
          ...baseStyle,
          position: 'fixed',
          ...(placement === 'top-right'
            ? { top: 'max(24px, env(safe-area-inset-top))' }
            : { bottom: 'max(24px, env(safe-area-inset-bottom))' }),
          right: '24px',
          zIndex: 50,
        }
      : baseStyle;

  return (
    <div role="status" aria-live="polite" data-status={status} style={style}>
      {message}
    </div>
  );
}
