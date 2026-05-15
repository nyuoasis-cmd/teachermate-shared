import { useEffect } from 'react';

export interface UseIosKeyboardScrollOptions {
  enabled?: boolean;
  delayMs?: number;
}

/**
 * §9.H-5 — iOS Safari에서 input/textarea focus 시 가상키보드가 가리는 문제 해결.
 * visualViewport API로 화면 영역 변화 감지 후 element.scrollIntoView 호출.
 * iOS user-agent 한정. 다른 환경은 no-op.
 */
export function useIosKeyboardScroll(options: UseIosKeyboardScrollOptions = {}): void {
  const { enabled = true, delayMs = 300 } = options;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    const isIos = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
    if (!isIos) return;

    const handler = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !isEditableElement(target)) return;

      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const visibleBottom = (vv.offsetTop ?? 0) + vv.height;
        if (rect.bottom > visibleBottom || rect.top < (vv.offsetTop ?? 0)) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, delayMs);
    };

    document.addEventListener('focusin', handler);
    return () => document.removeEventListener('focusin', handler);
  }, [enabled, delayMs]);
}

function isEditableElement(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(type);
  }
  return false;
}
