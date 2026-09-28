import { useEffect, useRef } from 'react';

/**
 * useBackClosable — 창(QR·팝업·메뉴·하단 시트)이 열려 있을 때 뒤로가기를 누르면 **창만 닫는다**.
 * DESIGN-POLICY §9.H-18 v2.4 표 첫 줄(「창이 열려 있음 → 창만 닫힌다. 화면은 그대로」).
 *
 * 원리: 창이 열릴 때 같은 주소로 기록 한 칸을 쌓고(pushState), 뒤로가기가 그 한 칸만 소비하게 한다.
 *  - 뒤로가기로 닫힘  → popstate 를 **capture 단계**에서 먼저 받아 onClose 를 부르고, 이벤트에 «소비됨» 표시를 단다.
 *                      useExitGuard 는 표시가 붙은 popstate 를 무시한다 → 창만 닫히고 나가기 확인창은 안 뜬다.
 *  - 버튼으로 닫힘    → open 이 false 가 되는 순간 history.back() 으로 쌓아 둔 한 칸을 치운다.
 *                      그 back 이 낳는 popstate 도 같은 방식으로 소비한다(가드가 오해하지 않게).
 *  - 창 안에서 다른 화면으로 이동 → 이동은 `navigate(to, { replace: true })` 로 한다. 그러면 쌓아 둔 칸이 새 화면으로
 *                      바뀌어 죽은 칸이 남지 않는다. push 로 이동하면 뒤로가기 한 번이 «창 닫힌 옛 화면» 에 서게 된다.
 *
 * 여러 창이 겹치면 맨 위 창만 닫힌다(창 스택은 window 전역 — 번들이 달라도 공유).
 * 라우터 무관(react-router·wouter·라우터 없음 모두). 라우터 state(key·idx)는 spread 로 보존한다.
 */

const STACK_KEY = '__tmBackClosableStack';
const SEQ_KEY = '__tmBackClosableSeq';
const ENTRY_KEY = '__tmBackClosable';
const CONSUMED_KEY = '__tmBackConsumed';

type ClosableGlobals = { [STACK_KEY]?: string[]; [SEQ_KEY]?: number };

function stack(): string[] {
  const w = window as unknown as ClosableGlobals;
  if (!w[STACK_KEY]) w[STACK_KEY] = [];
  return w[STACK_KEY] as string[];
}

function nextId(): string {
  const w = window as unknown as ClosableGlobals;
  w[SEQ_KEY] = (w[SEQ_KEY] ?? 0) + 1;
  return `tmbc-${w[SEQ_KEY]}`;
}

/** 이 popstate 를 창 닫기가 이미 가져갔는가 — useExitGuard 가 본다. */
export function isBackConsumed(event: Event | undefined | null): boolean {
  return Boolean(event && (event as unknown as Record<string, unknown>)[CONSUMED_KEY]);
}

function markConsumed(event: Event) {
  (event as unknown as Record<string, unknown>)[CONSUMED_KEY] = true;
}

function currentEntryId(): unknown {
  return (window.history.state as Record<string, unknown> | null | undefined)?.[ENTRY_KEY];
}

export function useBackClosable(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const id = nextId();
    stack().push(id);
    window.history.pushState({ ...window.history.state, [ENTRY_KEY]: id }, '', window.location.href);

    let settled = false; // 스택에서 빠졌다(더는 뒤로가기를 가져가지 않는다)
    let closingByUi = false; // 버튼으로 닫혀 우리가 부른 back() 의 popstate 를 기다리는 중

    const leaveStack = () => {
      const s = stack();
      const i = s.lastIndexOf(id);
      if (i >= 0) s.splice(i, 1);
    };

    const onPop = (event: PopStateEvent) => {
      if (settled) return;
      const s = stack();
      if (s[s.length - 1] !== id) return; // 맨 위 창만 뒤로가기를 가져간다
      if (currentEntryId() === id) return; // 아직 내 칸 위에 서 있다(앞으로가기 등) — 닫지 않는다
      settled = true;
      leaveStack();
      markConsumed(event);
      window.removeEventListener('popstate', onPop, true);
      if (!closingByUi) onCloseRef.current();
    };
    window.addEventListener('popstate', onPop, true); // capture — useExitGuard(버블)보다 먼저 받는다

    return () => {
      if (settled) return;
      if (currentEntryId() === id) {
        // 버튼으로 닫힘(또는 창을 연 채 언마운트) — 쌓아 둔 한 칸을 치우고, 그 popstate 는 onPop 이 소비한다.
        closingByUi = true;
        window.history.back();
        return;
      }
      // 내 칸이 이미 다른 칸으로 바뀌었다(창 안에서 replace 이동) — 치울 칸이 없다.
      settled = true;
      leaveStack();
      window.removeEventListener('popstate', onPop, true);
    };
  }, [open]);
}
