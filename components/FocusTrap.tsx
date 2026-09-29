import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useBackClosable } from '../hooks/useBackClosable';

export interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
  onEscape?: () => void;
  initialFocus?: 'first' | 'container' | RefObject<HTMLElement>;
  restoreFocus?: boolean;
  /**
   * 켜면 뒤로가기가 onEscape 를 부른다(창만 닫힘 · §9.H-18 v2.4). 기본 끔 —
   * FocusTrap 은 창이 아닌 곳(항상 열린 패널)에도 쓰이므로 창 쪽에서 켠다.
   */
  closeOnBack?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function FocusTrap({
  children,
  active = true,
  onEscape,
  initialFocus = 'first',
  restoreFocus = true,
  closeOnBack = false,
}: FocusTrapProps) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useBackClosable(Boolean(active && closeOnBack && onEscape), () => onEscapeRef.current?.());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const container = containerRef.current;
    if (!container) return;

    if (initialFocus === 'first') {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables[0]?.focus();
    } else if (initialFocus === 'container') {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container.focus();
    } else if (initialFocus && typeof initialFocus === 'object' && 'current' in initialFocus) {
      initialFocus.current?.focus();
    }

    return () => {
      if (restoreFocus && previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, initialFocus, restoreFocus]);

  useEffect(() => {
    if (!active) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || !container.contains(activeEl))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape]);

  return (
    <div ref={containerRef} data-focus-trap-active={active ? 'true' : 'false'}>
      {children}
    </div>
  );
}
