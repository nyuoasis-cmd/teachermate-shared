import { useRef, type CSSProperties, type KeyboardEvent } from 'react'

export type VerdictValue = 'pass' | 'partial' | 'fail'
export type VerdictTone = 'success' | 'warning' | 'danger' | 'neutral'

export interface VerdictOption<T extends string = VerdictValue> {
  value: T
  label: string
  tone: VerdictTone
}

export interface VerdictGroupProps<T extends string = VerdictValue> {
  name: string
  value: T | null
  onChange: (value: T) => void
  /** 직접 옵션 배열을 제공하면 generic value type 지원 (Step6 등 도메인 verdict 통합). */
  options?: VerdictOption<T>[]
  /** options 없을 때 default pass/partial/fail 라벨 커스터마이즈 (backward compat). */
  labels?: Partial<Record<VerdictValue, string>>
  disabled?: boolean
  ariaLabel?: string
  id?: string
}

const DEFAULT_LABELS: Record<VerdictValue, string> = {
  pass: '작동함',
  partial: '되긴 하는데…',
  fail: '안 됨',
}

const DEFAULT_PASS_PARTIAL_FAIL: VerdictOption<VerdictValue>[] = [
  { value: 'pass', label: DEFAULT_LABELS.pass, tone: 'success' },
  { value: 'partial', label: DEFAULT_LABELS.partial, tone: 'warning' },
  { value: 'fail', label: DEFAULT_LABELS.fail, tone: 'danger' },
]

export function VerdictGroup<T extends string = VerdictValue>({
  name,
  value,
  onChange,
  options,
  labels,
  disabled = false,
  ariaLabel = '판정',
  id,
}: VerdictGroupProps<T>) {
  const effectiveOptions: VerdictOption<T>[] = options
    ? options
    : (DEFAULT_PASS_PARTIAL_FAIL.map((opt) => ({
        ...opt,
        label: labels?.[opt.value] ?? opt.label,
      })) as VerdictOption<T>[])

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const order = effectiveOptions.map((o) => o.value)
  const focusableIndex = value !== null ? Math.max(0, order.indexOf(value)) : 0

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    if (disabled) return
    const idx = order.indexOf(current)
    if (idx === -1) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = order[(idx + 1) % order.length]
      onChange(next)
      buttonRefs.current[next]?.focus()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = order[(idx - 1 + order.length) % order.length]
      onChange(prev)
      buttonRefs.current[prev]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(order[0])
      buttonRefs.current[order[0]]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      const last = order[order.length - 1]
      onChange(last)
      buttonRefs.current[last]?.focus()
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      data-name={name}
      style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}
    >
      {effectiveOptions.map((opt, idx) => {
        const isSelected = value === opt.value
        const isFocusable = idx === focusableIndex
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              buttonRefs.current[opt.value] = el
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isFocusable ? 0 : -1}
            data-value={opt.value}
            data-name={name}
            data-tone={opt.tone}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(event) => handleKeyDown(event, opt.value)}
            style={getButtonStyle(opt.tone, isSelected, disabled)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function getButtonStyle(tone: VerdictTone, selected: boolean, disabled: boolean): CSSProperties {
  const tokens = TOKEN_BY_TONE[tone]
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
  }
  if (selected) {
    return {
      ...base,
      border: `1px solid var(${tokens.border}, ${tokens.borderFallback})`,
      background: `var(${tokens.bg}, ${tokens.bgFallback})`,
      color: `var(${tokens.text}, ${tokens.textFallback})`,
    }
  }
  return base
}

const TOKEN_BY_TONE: Record<
  VerdictTone,
  { bg: string; border: string; text: string; bgFallback: string; borderFallback: string; textFallback: string }
> = {
  success: {
    bg: '--color-success-bg',
    border: '--color-success-border',
    text: '--color-success-text',
    bgFallback: '#dcfce7',
    borderFallback: '#86efac',
    textFallback: '#166534',
  },
  warning: {
    bg: '--color-warning-bg',
    border: '--color-warning-border',
    text: '--color-warning-text',
    bgFallback: '#fef3c7',
    borderFallback: '#fcd34d',
    textFallback: '#92400e',
  },
  danger: {
    bg: '--color-danger-bg',
    border: '--color-danger-border',
    text: '--color-danger-text',
    bgFallback: '#fee2e2',
    borderFallback: '#fca5a5',
    textFallback: '#991b1b',
  },
  neutral: {
    bg: '--color-surface-hover',
    border: '--color-border-hover',
    text: '--color-text-primary',
    bgFallback: '#f5f5f4',
    borderFallback: '#d6d3d1',
    textFallback: '#1c1917',
  },
}
