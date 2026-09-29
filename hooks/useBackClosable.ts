import { useCallback, useEffect, useRef } from 'react';

/**
 * useBackClosable — 창(QR·팝업·메뉴·하단 시트)이 열려 있을 때 뒤로가기를 누르면 **창만 닫는다**.
 * DESIGN-POLICY §9.H-18 v2.4 표 첫 줄(「창이 열려 있음 → 창만 닫힌다. 화면은 그대로」).
 *
 * 원리: 창이 열릴 때 같은 주소로 기록 한 칸을 쌓고, 창이 열려 있는 동안의 뒤로가기는 그 창이 가져간다.
 *  - 뒤로가기로 닫힘  → popstate 를 **capture 단계**에서 먼저 받아 onClose 를 부르고, 이벤트에 «소비됨» 표시를 단다.
 *                      useExitGuard 는 표시가 붙은 popstate 를 무시한다 → 창만 닫히고 나가기 확인창은 안 뜬다.
 *  - 버튼으로 닫힘    → open 이 false 가 되는 순간 history.back() 으로 쌓아 둔 한 칸을 치운다(그 popstate 도 소비).
 *  - 창 안에서 다른 화면으로 이동 → 반환값 `closeThen(() => navigate(to))` 를 쓴다. 창 칸을 먼저 치운 **뒤에**
 *                      라우터가 push 한다. 🚨 replace 로 창 칸을 바꿔 끼우면 새 화면이 창을 연 화면의 깊이(idx)를
 *                      물려받아 «첫 화면» 으로 오판된다(codex 2026-09-28 high).
 *  - 창이 두 겹인데 아래 창만 먼저 닫힘 → 아래 창의 칸은 «빈 칸» 으로 남았다가, 위 창이 닫혀 그 칸에 서는 순간
 *                      한 번 더 back 해서 치운다(뒤로가기를 헛누르는 칸이 남지 않게 — codex 2026-09-28 high).
 *
 * 창이 열려 있는 동안의 뒤로가기는 **어느 칸으로 내려갔든** 맨 위 창이 가져간다. 창이 열린 뒤에 가드가
 * sentinel 을 그 위에 쌓아도(부모 가드가 자식 창보다 늦게 붙는 경우) 첫 뒤로가기는 창을 닫는다(codex 2026-09-28 high).
 *
 * 라우터 무관(react-router·wouter·라우터 없음 모두). 라우터 state(key·idx)는 spread 로 보존한다.
 */

const STACK_KEY = '__tmBackClosableStack';
const SEQ_KEY = '__tmBackClosableSeq';
const ENTRY_KEY = '__tmBackClosable';
const CONSUMED_KEY = '__tmBackConsumed';
const PENDING_KEY = '__tmBackClosablePending';
const DEFERRED_KEY = '__tmBackClosableDeferred';
/** closeThen 이 back 의 popstate 를 기다리는 한도(ms). 넘으면 이동을 그냥 진행한다(이동이 멈추는 것보다 낫다). */
const CLOSE_THEN_FALLBACK_MS = 300;

type ClosableGlobals = {
  [STACK_KEY]?: string[];
  [SEQ_KEY]?: number;
  [PENDING_KEY]?: number;
  [DEFERRED_KEY]?: Array<() => void>;
};

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

/*
 * 🔑 창 바꿔 끼우기(창 A 를 닫는 같은 순간 창 B 를 연다 — 예: 작은 QR → 「크게 띄우기」).
 * A 의 칸을 치우는 history.back() 은 비동기라, 그 사이 B 가 pushState 하면 back 이 **B 의 칸**을 치우고
 * B 가 곧바로 닫힌다. 그래서 우리가 부른 back 이 도착하기 전에는 새 창의 칸을 쌓지 않고 기다린다.
 */
function globals(): ClosableGlobals {
  return window as unknown as ClosableGlobals;
}

function pendingBacks(): number {
  return globals()[PENDING_KEY] ?? 0;
}

function deferred(): Array<() => void> {
  const w = globals();
  if (!w[DEFERRED_KEY]) w[DEFERRED_KEY] = [];
  return w[DEFERRED_KEY] as Array<() => void>;
}

/** 우리가 back() 을 부른다 — 그 popstate 가 올 때까지 새 창은 칸을 쌓지 않는다. */
function beginOwnBack() {
  globals()[PENDING_KEY] = pendingBacks() + 1;
}

/** 우리가 부른 back 이 도착했다(또는 기다림을 포기했다) — 기다리던 새 창을 연다. */
function endOwnBack() {
  const w = globals();
  w[PENDING_KEY] = Math.max(0, pendingBacks() - 1);
  if (w[PENDING_KEY] === 0) {
    const queue = deferred().splice(0);
    for (const activate of queue) activate();
  }
}

function currentEntryId(): unknown {
  return (window.history.state as Record<string, unknown> | null | undefined)?.[ENTRY_KEY];
}

type Instance = {
  id: string;
  /** 더는 아무 popstate 도 가져가지 않는다 */
  done: boolean;
  /** 우리가 부른 back() 의 popstate 를 기다리는 중 — onClose 를 다시 부르지 않는다 */
  closingByUi: boolean;
  /** closeThen 이 맡긴 이동 */
  after: (() => void) | null;
  /** 위 창보다 먼저 닫혀 칸만 남은 창 */
  zombie: boolean;
  awaitingZombieBack: boolean;
  /** beginOwnBack 을 부르고 아직 endOwnBack 을 안 불렀다 */
  ownBackPending: boolean;
  onPop: (event: PopStateEvent) => void;
  ownBack?: () => void;
  settleOwnBack?: () => void;
};

export interface BackClosable {
  /** 창 칸을 치운 **뒤에** fn(보통 라우터 push)을 부른다. 창이 안 열려 있으면 바로 부른다. */
  closeThen: (fn: () => void) => void;
}

export function useBackClosable(open: boolean, onClose: () => void): BackClosable {
  const onCloseRef = useRef(onClose);
  const instRef = useRef<Instance | null>(null);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    let inst: Instance | null = null;
    let cancelled = false;

    const ownBack = (target: Instance) => {
      if (!target.ownBackPending) {
        target.ownBackPending = true;
        beginOwnBack();
        // popstate 가 안 오는 기기 — 새 창을 영영 막지 않는다(settle 은 두 번 불려도 한 번만 푼다).
        window.setTimeout(() => settleOwnBack(target), CLOSE_THEN_FALLBACK_MS);
      }
      window.history.back();
    };
    const settleOwnBack = (target: Instance) => {
      if (!target.ownBackPending) return;
      target.ownBackPending = false;
      endOwnBack();
    };

    const activate = () => {
      if (cancelled) return;
      const id = nextId();
      stack().push(id);
      window.history.pushState({ ...window.history.state, [ENTRY_KEY]: id }, '', window.location.href);

      const leaveStack = () => {
        const s = stack();
        const i = s.lastIndexOf(id);
        if (i >= 0) s.splice(i, 1);
      };
      const finish = () => {
        me.done = true;
        leaveStack();
        window.removeEventListener('popstate', me.onPop, true);
      };

      const me: Instance = {
        id, done: false, closingByUi: false, after: null, zombie: false, awaitingZombieBack: false,
        ownBackPending: false,
        onPop: (event: PopStateEvent) => {
          if (me.done) return;
          if (me.zombie) {
            if (me.awaitingZombieBack) { markConsumed(event); finish(); settleOwnBack(me); return; }
            // 위 창이 닫혀 내 빈 칸에 섰다 — 한 칸 더 내려가 치운다.
            if (currentEntryId() === id) { markConsumed(event); me.awaitingZombieBack = true; ownBack(me); }
            return;
          }
          const s = stack();
          if (s[s.length - 1] !== id) return; // 맨 위 창만 뒤로가기를 가져간다
          markConsumed(event);
          finish();
          settleOwnBack(me); // 기다리던 새 창은 이 칸이 치워진 **뒤에** 쌓인다
          if (me.after) {
            const fn = me.after;
            me.after = null;
            fn();
          } else if (!me.closingByUi) {
            onCloseRef.current();
          }
        },
      };
      me.ownBack = () => ownBack(me);
      me.settleOwnBack = () => settleOwnBack(me);
      inst = me;
      instRef.current = me;
      window.addEventListener('popstate', me.onPop, true); // capture — useExitGuard(버블)보다 먼저 받는다
    };

    if (pendingBacks() > 0) deferred().push(activate);
    else activate();

    return () => {
      cancelled = true;
      const q = deferred();
      const qi = q.indexOf(activate);
      if (qi >= 0) q.splice(qi, 1); // 칸을 쌓기도 전에 닫혔다 — 치울 칸이 없다
      const me = inst;
      if (!me) return;
      if (instRef.current === me) instRef.current = null;
      if (me.done || me.closingByUi) return; // 이미 닫혔거나 closeThen 이 진행 중
      const s = stack();
      const isTop = s[s.length - 1] === me.id;
      if (isTop && currentEntryId() === me.id) {
        // 버튼으로 닫힘(또는 창을 연 채 언마운트) — 쌓아 둔 한 칸을 치우고, 그 popstate 는 onPop 이 소비한다.
        // (가드 sentinel 이 내 칸을 복사해 위에 섰어도 같은 id 라 여기로 온다 — back 이 그 칸을 치운다.)
        me.closingByUi = true;
        ownBack(me);
        return;
      }
      if (!isTop && s.includes(me.id)) {
        // 위에 다른 창이 열려 있다 — 내 칸은 그 아래 빈 칸으로 남는다. 위 창이 닫히면 치운다.
        const i = s.lastIndexOf(me.id);
        if (i >= 0) s.splice(i, 1);
        me.zombie = true;
        return;
      }
      // 내 칸이 이미 다른 칸으로 바뀌었다(라우터 이동) — 치울 칸이 없다.
      me.done = true;
      const i = s.lastIndexOf(me.id);
      if (i >= 0) s.splice(i, 1);
      window.removeEventListener('popstate', me.onPop, true);
    };
  }, [open]);

  const closeThen = useCallback((fn: () => void) => {
    const inst = instRef.current;
    if (!inst || inst.done || inst.zombie || typeof window === 'undefined') { fn(); return; }
    const s = stack();
    if (s[s.length - 1] !== inst.id || currentEntryId() !== inst.id) { fn(); return; }
    inst.closingByUi = true;
    inst.after = fn;
    inst.ownBack?.();
    window.setTimeout(() => {
      if (inst.done || !inst.after) return;
      // back 의 popstate 가 안 왔다(아주 느린 기기) — 이동을 멈추지 않는다.
      const after = inst.after;
      inst.after = null;
      inst.done = true;
      const st = stack();
      const i = st.lastIndexOf(inst.id);
      if (i >= 0) st.splice(i, 1);
      window.removeEventListener('popstate', inst.onPop, true);
      inst.settleOwnBack?.();
      after();
    }, CLOSE_THEN_FALLBACK_MS);
  }, []);

  return { closeThen };
}
