import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useExitGuard — 브라우저/하드웨어 뒤로가기로 앱 밖 이탈을 막는 라우터-무관 표준 훅.
 * DESIGN-POLICY §9.H-18 단일 소스. popstate + history.state sentinel 방식(useBlocker 미사용 →
 * react-router optional peer 계약 준수). 깊은 동작 계약은 PLAN-useexitguard.md ADR-1 부속이 단일 진실 소스.
 *
 * 책임 경계:
 *  - ✅ 막음: 브라우저 뒤로가기, 모바일 하드웨어 뒤로가기, (보조) 탭 닫기/새로고침(자체 beforeunload).
 *  - ❌ 안 막음: 앱 내부 SPA 네비(<Link>/navigate/redirect) — popstate 미발생. 호출자가 releaseAndNavigate로 감싸거나
 *               BackToSessions로 confirm 담당(슬라이스 1 인벤토리).
 *
 * 핵심 불변식:
 *  - 단일 소유자(ownsSentinelRef): 한 entry의 sentinel은 한 인스턴스만 소유. passive 인스턴스는 popstate에서 완전 no-op.
 *  - history.back()은 오직 serializedRelease(confirmExit/releaseAndNavigate) 1군데서만 — 그것도 자기 sentinel을 소유할 때만.
 *  - 일반 disarm(when→false)·언마운트 cleanup은 절대 history.back() 안 함(이탈 의도 신호 없음 → bounded stale 수용).
 *  - terminal disarm 먼저, cb는 나중: releasedRef 동기 set → 가드 표면(popstate/rearm/beforeunload) 차단 → cb 정확히 1회.
 *  - 소유권 레지스트리는 window-global(번들/버전 간 공유) — 타 번들의 활성 sentinel을 덮어쓰지 않음(codex 버전-스큐).
 */

const SENTINEL_KEY = '__tmExitGuard';
/** history.back() 후 popstate 미도달 시 dead-exit 차단용 fallback(ms). */
const RELEASE_FALLBACK_MS = 50;
/** fallback이 cb를 실행한 뒤 late traversal popstate를 흡수하기 위해 listener를 유지하는 유예(ms). */
const RELEASE_FALLBACK_GRACE_MS = 200;

/** window-global 키 — 번들/버전이 달라도 같은 window를 공유하면 소유권을 함께 본다(codex 버전-스큐 대응). */
const REGISTRY_KEY = '__tmExitGuardOwners';
const SEQ_KEY = '__tmExitGuardSeq';

interface ExitGuardGlobals {
  [REGISTRY_KEY]?: Set<string>;
  [SEQ_KEY]?: number;
}

/** SSR/비-브라우저 폴백용 모듈 레지스트리(window 없을 때만 사용). */
const fallbackRegistry = new Set<string>();
let fallbackSeq = 0;

/** 현재 살아있는(소유 중인) 가드 uid 레지스트리. window가 있으면 window-global, 없으면 모듈 폴백. */
function getRegistry(): Set<string> {
  if (typeof window === 'undefined') return fallbackRegistry;
  const w = window as unknown as ExitGuardGlobals;
  if (!w[REGISTRY_KEY]) w[REGISTRY_KEY] = new Set<string>();
  return w[REGISTRY_KEY] as Set<string>;
}

function nextExitGuardUid(): string {
  if (typeof window === 'undefined') {
    fallbackSeq += 1;
    return `tmxg-ssr-${fallbackSeq}`;
  }
  const w = window as unknown as ExitGuardGlobals;
  const next = (w[SEQ_KEY] ?? 0) + 1;
  w[SEQ_KEY] = next; // 같은 window를 공유하는 모든 번들이 단조 증가 카운터를 공유 → uid 전역 유니크.
  return `tmxg-${next}`;
}

/** 빌드 호환 DEV 감지(SC-9). tsc `types:[react,react-dom]`라 리터럴 DEV 접근은 typecheck 실패 → typed 캐스트 형태만 허용. */
const IS_DEV = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

/** 이탈 콜백 — 동기 또는 async. async가 reject되면 이탈 실패로 보고 가드를 복구한다(codex R6). */
export type ExitGuardCallback = () => void | Promise<void>;

export interface UseExitGuardOptions {
  /** 가드 활성(예: isDirty 또는 세션 진행 중). */
  when: boolean;
  /** 사용자가 "나가기"를 확정했을 때 실제 이탈 동작(navigate/leave). 동기·async 모두 허용. */
  onConfirmExit: ExitGuardCallback;
  /** 확인 모달 본문(옵션). */
  message?: string;
}

export interface UseExitGuardReturn {
  /** 확인 모달 표시 여부. */
  promptOpen: boolean;
  /** 모달 "나가기" — serializedRelease(onConfirmExit). */
  confirmExit: () => void;
  /** 모달 "취소" — 잔류. */
  cancelExit: () => void;
  /** 가드 화면을 떠나는 내부 이탈 — serializedRelease(navigate). sentinel 소비(popstate 완료) 후에만 navigate 1회. */
  releaseAndNavigate: (navigate: ExitGuardCallback) => void;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function readSentinelMarker(): unknown {
  return (window.history.state as Record<string, unknown> | null | undefined)?.[SENTINEL_KEY];
}

export function useExitGuard(opts: UseExitGuardOptions): UseExitGuardReturn {
  const { when, onConfirmExit } = opts;

  const uidRef = useRef<string>('');
  if (!uidRef.current) {
    uidRef.current = nextExitGuardUid();
  }

  const [promptOpen, setPromptOpen] = useState(false);

  // 이벤트 시점에 읽는 최신값 ref들(렌더 후 동기화).
  const whenRef = useRef(when);
  const onConfirmExitRef = useRef(onConfirmExit);
  // sentinel을 내가 소유하는가(= popstate 차단/재push, back 보정의 게이트).
  const ownsSentinelRef = useRef(false);
  // terminal disarm 동기 latch — true면 popstate/beforeunload/rearm 전부 no-op.
  const releasedRef = useRef(false);
  // 컴포넌트 마운트 여부 — cb 실패 복구가 살아있는 인스턴스에만 적용되도록(async 컨텍스트 안전).
  const mountedRef = useRef(true);

  useEffect(() => {
    onConfirmExitRef.current = onConfirmExit;
    whenRef.current = when;
  });

  /** 내 sentinel을 현재 entry에 push(이미 내 마커면 재소유만). arm 효과·실패 복구 공용 프리미티브. */
  const armSentinel = useCallback(() => {
    const registry = getRegistry();
    if (readSentinelMarker() === uidRef.current) {
      ownsSentinelRef.current = true;
      registry.add(uidRef.current);
      return;
    }
    window.history.pushState(
      { ...window.history.state, [SENTINEL_KEY]: uidRef.current },
      '',
      window.location.href,
    );
    ownsSentinelRef.current = true;
    registry.add(uidRef.current);
  }, []);

  /**
   * serializedRelease — confirmExit·releaseAndNavigate 공용 프리미티브.
   * terminal disarm을 sentinel 소비 전에 먼저 수행하고, cb는 popstate 완료(또는 fallback) 후 정확히 1회.
   * fallback 이후 늦게 도착하는 traversal popstate도 idempotent하게 흡수(codex late-popstate).
   * cb가 throw(이탈 실패)하면 가드를 복구해 dirty 페이지가 무방비로 남지 않게 한다(codex R5 finding1).
   */
  const serializedRelease = useCallback(
    (cb: ExitGuardCallback) => {
    if (releasedRef.current) return; // latch: 이미 release 진행/완료 → 재진입 차단.
    releasedRef.current = true; // (1) 동기 terminal disarm — 이후 popstate/beforeunload 핸들러 no-op.
    setPromptOpen(false); // (4) 모달 clear.

    // 호출 직전 자기 sentinel을 소유한 entry일 때만 back() 보정(소유권-skip — SC-T24).
    const owns = ownsSentinelRef.current && readSentinelMarker() === uidRef.current;
    ownsSentinelRef.current = false;
    getRegistry().delete(uidRef.current);

    // cb 실패(throw 또는 async reject) → 이탈이 실제로 일어나지 않음. 마운트 유지·여전히 dirty면 가드 재가동(data-loss 방지).
    const restoreOnFailure = () => {
      if (mountedRef.current && whenRef.current) {
        releasedRef.current = false;
        armSentinel();
      }
    };
    // async cb의 거부도 동일 복구 경로로 — () => void 타입이어도 호출자가 async를 넘길 수 있음(codex R6).
    const watchAsync = (result: void | Promise<void>, onFail: () => void) => {
      if (isThenable(result)) {
        result.then(undefined, (err: unknown) => {
          onFail();
          if (IS_DEV) console.error('useExitGuard: 이탈 콜백(async)이 실패해 가드를 복구합니다.', err);
        });
      }
    };

    if (!owns) {
      let result: void | Promise<void>;
      try {
        result = cb(); // (6) 비소유 — 기다릴 traversal 없음, 즉시 1회.
      } catch (err) {
        restoreOnFailure();
        throw err;
      }
      watchAsync(result, restoreOnFailure);
      return;
    }

    // (5) 소유 — history.back()으로 sentinel 소비 후, one-shot popstate 또는 fallback에서 cb 1회.
    let settled = false;
    let fallbackFired = false;
    let intendedHref: string | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    // runCb는 예외-안전: cb가 throw해도 흡수 컨트롤러 정리 + 가드 복구 보장(codex R3 leak·R5 finding1).
    const runCb = () => {
      if (settled) return; // latch: 중복/late popstate·fallback 경합에도 cb 1회(SC-T15/T19).
      settled = true;
      let result: void | Promise<void>;
      try {
        result = cb();
      } catch (err) {
        teardown(); // 흡수 컨트롤러 제거(복구할 거라 dangling 금지).
        restoreOnFailure(); // 마운트·dirty면 가드 재가동.
        throw err; // 정리·복구 후 에러 표면화.
      }
      if (isThenable(result)) {
        // async cb: 네비게이션이 promise 이후에 일어남 → cb 직후 href 캡처 금지(stale 가드 URL 복원=yank 방지, codex R9).
        intendedHref = null; // settle 전까지 위치복원 비활성(대기 중 late popstate는 흡수만, 복원 X).
        result.then(
          () => {
            intendedHref = window.location.href; // settle(네비게이션 후) 시점 URL을 목적지로 기록.
          },
          (err: unknown) => {
            teardown(); // 거부 → 흡수 컨트롤러 정리 + 가드 복구.
            restoreOnFailure();
            if (IS_DEV) console.error('useExitGuard: 이탈 콜백(async)이 실패해 가드를 복구합니다.', err);
          },
        );
      } else {
        intendedHref = window.location.href; // sync cb: 이미 네비게이션 완료 → 정확한 목적지 기록.
      }
    };
    const teardown = () => {
      window.removeEventListener('popstate', onReleasePop);
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      if (graceTimer !== undefined) clearTimeout(graceTimer);
    };
    function onReleasePop() {
      if (!settled) {
        // 정상 경로: traversal이 fallback보다 먼저 도착 → cb 1회 후 완전 정리(cb throw해도 teardown 보장).
        try {
          runCb();
        } finally {
          teardown();
        }
        return;
      }
      // late traversal: fallback이 이미 cb를 실행. 늦게 도착한 back()이 물리적 위치를 목적지에서 옮겼으면
      // best-effort로 URL 복원(codex A). ⚠️ router-agnostic 한계 — URL 위치만 복원 가능하고 router 상태
      // 재동기화는 본 훅 범위 밖(Data Router는 ADR-4 어댑터 슬라이스). 물리적 traversal 자체는 bounded(ADR-5).
      try {
        if (fallbackFired && intendedHref !== null && window.location.href !== intendedHref) {
          window.history.pushState({ ...window.history.state }, '', intendedHref);
        }
      } finally {
        teardown();
      }
    }

    // ⚠️ release 흡수 컨트롤러(onReleasePop + fallback/grace 타이머)는 컴포넌트 라이프사이클과 독립이다(codex R4).
    //    실제 releaseAndNavigate는 cb가 라우트 전환→이 훅을 언마운트하므로, 언마운트 cleanup이 이걸 떼면
    //    늦은 traversal을 흡수·복원하지 못한다. 따라서 unmount는 건드리지 않고, 정상 popstate(즉시)·fallback
    //    grace 만료(최대 RELEASE_FALLBACK_MS+GRACE) 둘 중 하나로 self-tear → 무한 누수 없음.
    window.addEventListener('popstate', onReleasePop);
    fallbackTimer = setTimeout(() => {
      // dead-exit 차단: popstate 미도달 시 cb 실행. 성공 시에만 grace 동안 흡수 listener 유지(실패면 runCb가 이미 정리·복구).
      fallbackFired = true;
      if (IS_DEV) {
        // fail-closed 관측 신호(codex R10): 정상 환경의 back() popstate는 즉시 도착 — fallback 발화는 비정상.
        // grace(=RELEASE_FALLBACK_GRACE_MS) 이후 도착하는 매우 지연된 traversal은 흡수·복원 못 함(router-agnostic
        // 한계, Data Router는 ADR-4 어댑터 슬라이스에서 useBlocker로 정밀 차단). 자세히 → SDD "Slice 0 미보장" 절.
        console.warn(
          'useExitGuard: 뒤로가기 traversal이 fallback 창 내에 관측되지 않아 콜백을 진행합니다. ' +
            '매우 느린 환경(jank/BFCache)에서 지연된 traversal이 history 위치를 어긋나게 할 수 있습니다(bounded — ADR-5).',
        );
      }
      let ok = false;
      try {
        runCb();
        ok = true;
      } finally {
        if (ok) graceTimer = setTimeout(teardown, RELEASE_FALLBACK_GRACE_MS); // late traversal 흡수·복원 후 정리.
      }
    }, RELEASE_FALLBACK_MS);
    window.history.back();
    },
    [armSentinel],
  );

  const confirmExit = useCallback(() => {
    serializedRelease(() => onConfirmExitRef.current());
  }, [serializedRelease]);

  const releaseAndNavigate = useCallback(
    (navigate: ExitGuardCallback) => {
      serializedRelease(navigate);
    },
    [serializedRelease],
  );

  const cancelExit = useCallback(() => {
    // popstate 차단 시 이미 sentinel이 재push되어 있으므로 추가 history 조작 없음(중복 방지 — 항목 4).
    setPromptOpen(false);
  }, []);

  // 가드 표면(popstate/beforeunload) 핸들러 — 마운트 1회 등록, 이벤트 시점 ref로 게이팅.
  const onPopState = useCallback(() => {
    if (releasedRef.current) return; // release 후 추가 popstate no-op(SC-T9).
    if (!whenRef.current) return; // disarm 상태(when=false) — 통과시킴(SC-T6).
    if (!ownsSentinelRef.current) return; // passive(비소유) — 완전 no-op(SC-T14).
    // 소유 + 가드 활성 상태에서의 뒤로가기 → 모달 + sentinel 재push(정확히 1개)로 잔류.
    setPromptOpen(true);
    window.history.pushState(
      { ...window.history.state, [SENTINEL_KEY]: uidRef.current },
      '',
      window.location.href,
    );
  }, []);

  const onBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (releasedRef.current) return; // 동기 disarm — confirmed-exit cb가 location.assign해도 이중 프롬프트 0(SC-T8).
    if (!ownsSentinelRef.current) return; // passive(비소유)는 beforeunload도 막지 않음 — owner가 담당(codex B, SC-T8b).
    if (!whenRef.current) return;
    event.preventDefault();
    event.returnValue = '';
  }, []);

  useEffect(() => {
    mountedRef.current = true; // StrictMode 재마운트(setup→cleanup→setup) 후에도 복구가 살아있도록 setup마다 복원(codex R7).
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // ⚠️ 진행 중인 release 흡수 컨트롤러는 일부러 건드리지 않는다(codex R4) — cb의 라우트 전환이 이 훅을
      //    언마운트하는 정상 흐름에서도 late traversal 흡수·복원이 살아있어야 함. self-tear로 누수 방지.
      // 언마운트 cleanup(항목 6): listener/레지스트리만 정리. history.back() 절대 금지 → bounded stale 1개 수용.
      // (StrictMode 가짜 언마운트도 동일 — remount 시 arm()이 marker===uid를 보고 재push 없이 재소유.)
      getRegistry().delete(uidRef.current);
      ownsSentinelRef.current = false;
      mountedRef.current = false; // 이후 cb 실패 복구가 죽은 인스턴스를 재arm하지 않도록(codex R5).
    };
  }, [onPopState, onBeforeUnload]);

  // arm/disarm — when 전이에만 반응. idempotent(소유 중이면 재push 금지).
  useEffect(() => {
    whenRef.current = when;
    if (releasedRef.current) return; // release 후엔 언마운트까지 재arm 안 함(1회성).
    if (!when) return; // 일반 disarm: 핸들러가 whenRef로 no-op. history.back() 금지(항목 5).

    // idempotent skip은 "실제로 내 sentinel이 현재 entry에 살아있을 때"만(SC-T1). 소유권 플래그만 믿지 않는다 —
    // disarm 중 Back으로 sentinel이 소비되면 owns=true인데 마커가 사라질 수 있어, 그땐 재arm으로 재조정해야 함(codex R8).
    if (ownsSentinelRef.current && readSentinelMarker() === uidRef.current) return;

    const registry = getRegistry();
    const marker = readSentinelMarker();
    if (marker === uidRef.current) {
      // 현재 entry가 이미 내 sentinel(remount/재arm) → 재push 없이 재소유.
      ownsSentinelRef.current = true;
      registry.add(uidRef.current);
      return;
    }
    if (typeof marker === 'string' && registry.has(marker)) {
      // 다른 활성 가드(같은/타 번들)가 이 entry를 소유 → 덮어쓰기 금지, passive(완전 no-op).
      // ⚠️ registry는 window-global이라 타 번들/버전의 활성 sentinel도 보인다(codex 버전-스큐).
      //    레지스트리에 없는 문자열 마커는 stale로 간주해 재arm 허용(SC-T22 bounded remount).
      ownsSentinelRef.current = false;
      if (IS_DEV && when) {
        // 조용한 무력화 금지 — 라우트당 1개 계약(codex R11/R12).
        console.error(
          'useExitGuard: 한 라우트에는 useExitGuard를 1개만 마운트하세요 — 두 번째 가드의 보호가 비활성화됩니다.',
        );
      }
      return;
    }

    // 마커 없음 또는 stale(레지스트리에 없는 문자열) → 내 sentinel을 1회 push해 소유(armSentinel).
    // router state는 spread merge로 보존(SC-4), URL 유지.
    armSentinel();
  }, [when, armSentinel]);

  return { promptOpen, confirmExit, cancelExit, releaseAndNavigate };
}
