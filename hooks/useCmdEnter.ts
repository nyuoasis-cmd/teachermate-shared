import { useEffect, type RefObject } from 'react';

export interface UseCmdEnterOptions {
  enabled?: boolean;
  targetRef?: RefObject<HTMLElement | null>;
}

/**
 * §9.H-8 부록 P — S3 editor surface에서 Cmd/Ctrl+Enter로 submit.
 * 모바일 가상 키보드에서는 의미 없음 — 데스크탑 한정 단축키.
 */
export function useCmdEnter(onSubmit: () => void, options: UseCmdEnterOptions = {}): void {
  const { enabled = true, targetRef } = options;

  useEffect(() => {
    if (!enabled) return;
    const target: HTMLElement | Document = targetRef?.current ?? document;

    const handler = (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter' && (keyEvent.metaKey || keyEvent.ctrlKey)) {
        keyEvent.preventDefault();
        onSubmit();
      }
    };

    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
  }, [enabled, onSubmit, targetRef]);
}
