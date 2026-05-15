import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

export type VerdictValue = 'pass' | 'partial' | 'fail';

export interface VerdictGroupProps {
  name: string;
  value: VerdictValue | null;
  onChange: (value: VerdictValue) => void;
  labels?: Partial<Record<VerdictValue, string>>;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
}

const ORDER: readonly VerdictValue[] = ['pass', 'partial', 'fail'];

const DEFAULT_LABELS: Record<VerdictValue, string> = {
  pass: '작동함',
  partial: '되긴 하는데…',
  fail: '안 됨',
};

export function VerdictGroup({
  name,
  value,
  onChange,
  labels,
  disabled = false,
  ariaLabel = '판정',
  id,
}: VerdictGroupProps) {
  const buttonRefs = useRef<Record<VerdictValue, HTMLButtonElement | null>>({
    pass: null,
    partial: null,
    fail: null,
  });

  const focusableIndex = value !== null ? ORDER.indexOf(value) : 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: VerdictValue) => {
    if (disabled) return;
    const idx = ORDER.indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = ORDER[(idx + 1) % ORDER.length];
      onChange(next);
      buttonRefs.current[next]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = ORDER[(idx - 1 + ORDER.length) % ORDER.length];
      onChange(prev);
      buttonRefs.current[prev]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(ORDER[0]);
      buttonRefs.current[ORDER[0]]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = ORDER[ORDER.length - 1];
      onChange(last);
      buttonRefs.current[last]?.focus();
    }
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      data-name={name}
      style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}
    >
      {ORDER.map((v, idx) => {
        const isSelected = value === v;
        const label = labels?.[v] ?? DEFAULT_LABELS[v];
        const isFocusable = idx === focusableIndex;
        return (
          <button
            key={v}
            ref={(el) => {
              buttonRefs.current[v] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isFocusable ? 0 : -1}
            data-value={v}
            data-name={name}
            disabled={disabled}
            onClick={() => onChange(v)}
            onKeyDown={(event) => handleKeyDown(event, v)}
            style={getButtonStyle(v, isSelected, disabled)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function getButtonStyle(value: VerdictValue, selected: boolean, disabled: boolean): CSSProperties {
  const tokens = TOKEN_BY_VALUE[value];
  const base: CSSProperties = {
    flex: 1,
    minHeight: '44px',
    padding: '10px 8px',
    borderRadius: '10px',
    border: '1px solid var(--color-border, #e7e5e4)',
    background: 'var(--color-surface, #ffffff)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-body, #57534e)',
    lineHeight: 1.3,
    transition: 'border-color 160ms cubic-bezier(.2,.8,.2,1), background 160ms cubic-bezier(.2,.8,.2,1), color 160ms cubic-bezier(.2,.8,.2,1)',
    opacity: disabled ? 0.5 : 1,
    wordBreak: 'keep-all',
  };
  if (selected) {
    return {
      ...base,
      border: `1px solid var(${tokens.border}, ${tokens.borderFallback})`,
      background: `var(${tokens.bg}, ${tokens.bgFallback})`,
      color: `var(${tokens.text}, ${tokens.textFallback})`,
    };
  }
  return base;
}

const TOKEN_BY_VALUE: Record<
  VerdictValue,
  { bg: string; border: string; text: string; bgFallback: string; borderFallback: string; textFallback: string }
> = {
  pass: {
    bg: '--color-success-bg',
    border: '--color-success-border',
    text: '--color-success-text',
    bgFallback: '#dcfce7',
    borderFallback: '#86efac',
    textFallback: '#166534',
  },
  partial: {
    bg: '--color-warning-bg',
    border: '--color-warning-border',
    text: '--color-warning-text',
    bgFallback: '#fef3c7',
    borderFallback: '#fcd34d',
    textFallback: '#92400e',
  },
  fail: {
    bg: '--color-danger-bg',
    border: '--color-danger-border',
    text: '--color-danger-text',
    bgFallback: '#fee2e2',
    borderFallback: '#fca5a5',
    textFallback: '#991b1b',
  },
};
