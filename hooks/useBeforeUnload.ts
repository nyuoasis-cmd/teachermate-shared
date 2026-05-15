import { useEffect } from 'react';

export interface UseBeforeUnloadOptions {
  enabled?: boolean;
}

/**
 * §9.H-8 부록 P — 미저장 변경 상태에서 페이지 이탈 시 native confirm 표시.
 * 호출자가 "dirty" 판정(예: 50자 초과 변경) 책임.
 */
export function useBeforeUnload(isDirty: boolean, options: UseBeforeUnloadOptions = {}): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled || !isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, isDirty]);
}
