// @vitest-environment jsdom

import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExitGuard, type UseExitGuardReturn } from '../hooks/useExitGuard';

const SENTINEL_KEY = '__tmExitGuard';

// useExitGuard 반환값을 인스턴스별로 캡처(여러 인스턴스 테스트 지원).
let guards: Record<string, UseExitGuardReturn>;

function Probe({
  id = 'a',
  when,
  onConfirmExit,
}: {
  id?: string;
  when: boolean;
  onConfirmExit?: () => void;
}) {
  const g = useExitGuard({ when, onConfirmExit: onConfirmExit ?? (() => {}) });
  guards[id] = g;
  return <div data-testid={`prompt-${id}`}>{String(g.promptOpen)}</div>;
}

/** 사용자 뒤로가기/traversal 완료를 시뮬레이션(jsdom은 실제 history.back 모킹 상태이므로 수동 dispatch). */
function dispatchPopState() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
}

/** spy 호출 중 우리 sentinel 마커를 담은 pushState 횟수. */
function sentinelPushCount(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter(
    (c) => (c[0] as Record<string, unknown> | null | undefined)?.[SENTINEL_KEY] != null,
  ).length;
}

let pushSpy: ReturnType<typeof vi.spyOn>;
let backSpy: ReturnType<typeof vi.spyOn>;

type ExitGuardWindow = { __tmExitGuardOwners?: Set<string>; __tmExitGuardSeq?: number };

beforeEach(() => {
  guards = {};
  // 깨끗한 현재 entry + window-global 소유권 레지스트리/seq 리셋(테스트 결정성).
  window.history.replaceState({}, '', window.location.href);
  (window as unknown as ExitGuardWindow).__tmExitGuardOwners = new Set();
  (window as unknown as ExitGuardWindow).__tmExitGuardSeq = 0;
  pushSpy = vi.spyOn(window.history, 'pushState'); // call-through(실제 push로 state 반영).
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {}); // traversal 미발생 → popstate 수동 제어.
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useExitGuard — sentinel 생명주기 계약 (SC-T1~T24)', () => {
  // SC-T1 (정상) 리렌더에도 sentinel push 1회만(idempotent).
  it('SC-T1: 3회 리렌더에도 sentinel은 1번만 push된다', () => {
    const { rerender } = render(<Probe when={true} />);
    rerender(<Probe when={true} />);
    rerender(<Probe when={true} />);
    rerender(<Probe when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(1);
  });

  // SC-T2 (정상) 뒤로가기 → 모달 + 잔류 + 재push.
  it('SC-T2: when=true에서 뒤로가기 시 모달이 뜨고 sentinel을 재push해 잔류한다', () => {
    render(<Probe when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(1);
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
    expect(sentinelPushCount(pushSpy)).toBe(2); // arm 1 + 차단 재push 1.
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T3 (정상) cancel 반복 → history 불변·잔류.
  it('SC-T3: 모달에서 취소를 2번 눌러도 history는 변하지 않고 잔류한다', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    const after = sentinelPushCount(pushSpy);
    act(() => guards.a.cancelExit());
    act(() => guards.a.cancelExit());
    expect(guards.a.promptOpen).toBe(false);
    expect(sentinelPushCount(pushSpy)).toBe(after); // 추가 push 0.
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T4 (정상) confirmExit → back popstate 완료 후 onConfirmExit 1회, sentinel 소비.
  it('SC-T4: 나가기는 뒤로가기 처리 완료 후 onConfirmExit을 정확히 1번 호출한다', () => {
    const onConfirm = vi.fn();
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    dispatchPopState();
    act(() => guards.a.confirmExit());
    expect(onConfirm).not.toHaveBeenCalled(); // back 완료 전 동기 호출 금지.
    expect(backSpy).toHaveBeenCalledTimes(1); // sentinel 소비.
    dispatchPopState(); // traversal 완료 신호.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(guards.a.promptOpen).toBe(false);
  });

  // SC-T5 (예외) confirmExit popstate 누락 → fallback이 1회 호출(dead-exit 없음).
  it('SC-T5: 뒤로가기 신호가 안 와도 fallback으로 onConfirmExit이 1번 호출된다', () => {
    const onConfirm = vi.fn();
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    dispatchPopState();
    vi.useFakeTimers();
    act(() => guards.a.confirmExit());
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60); // RELEASE_FALLBACK_MS(50) 초과.
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // SC-T6 (경계) when true→false → history.back 미호출, URL 불변.
  it('SC-T6: 저장으로 when=false가 되어도 강제로 이전 페이지로 보내지 않는다', () => {
    const url = window.location.href;
    const { rerender } = render(<Probe when={true} />);
    rerender(<Probe when={false} />);
    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
    // disarm 상태에서 뒤로가기는 통과(모달 안 뜸).
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(false);
  });

  // SC-T6b (경계, stale 소유권 재조정 — codex R8 high) disarm 중 Back으로 sentinel 소비 후 재편집하면 새 sentinel을 push해 가드.
  it('SC-T6b: disarm 중 Back으로 sentinel이 소비된 뒤 재편집하면 새 sentinel을 다시 push해 가드한다', () => {
    const { rerender } = render(<Probe when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(1); // arm.
    rerender(<Probe when={false} />); // 저장 → disarm(소유권은 Plan대로 유지).
    // disarm 중 사용자가 Back → sentinel이 소비돼 현재 entry에서 마커가 사라진 상태 모사.
    act(() => {
      window.history.replaceState({}, '', window.location.href);
    });
    dispatchPopState(); // when=false → no-op(가드 안 함, 정상).
    expect(guards.a.promptOpen).toBe(false);
    expect((window.history.state as Record<string, unknown>)[SENTINEL_KEY]).toBeUndefined(); // 마커 없음.
    // 다시 편집 → 재arm. owns=true지만 마커가 없으므로 idempotent skip 안 하고 새 sentinel push.
    const before = sentinelPushCount(pushSpy);
    rerender(<Probe when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(before + 1); // 새 sentinel push(stale owns로 skip 안 함).
    expect((window.history.state as Record<string, unknown>)[SENTINEL_KEY]).toBeDefined(); // 가드 버퍼 복원.
    // 이제 Back은 다시 가드됨.
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
  });

  // SC-T7 (경계) 가드 활성 중 언마운트 → history.back 미호출.
  it('SC-T7: 가드 활성 중 언마운트되어도 history.back을 부르지 않는다', () => {
    const { unmount } = render(<Probe when={true} />);
    unmount();
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T8 (예외) 이탈 확정 후 동기 disarm → beforeunload 이중 프롬프트 0.
  it('SC-T8: 나가기 확정(동기 disarm) 후에는 beforeunload가 차단하지 않는다', () => {
    render(<Probe when={true} />);
    // release 전: 가드 활성 → beforeunload 차단.
    const e1 = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e1, 'returnValue', { writable: true, value: '' });
    act(() => {
      window.dispatchEvent(e1);
    });
    expect(e1.defaultPrevented).toBe(true);
    // release(confirmExit) — releasedRef 동기 set.
    act(() => guards.a.confirmExit());
    // release 후: 컴포넌트는 아직 마운트·when=true지만 beforeunload 미차단.
    const e2 = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e2, 'returnValue', { writable: true, value: '' });
    act(() => {
      window.dispatchEvent(e2);
    });
    expect(e2.defaultPrevented).toBe(false);
  });

  // SC-T9 (예외) release 후 추가 popstate → 모달 재오픈·재push 0.
  it('SC-T9: 이탈 확정 후 추가 뒤로가기가 와도 모달 재오픈·sentinel 재생성이 없다', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    act(() => guards.a.confirmExit());
    dispatchPopState(); // release 소비.
    const after = sentinelPushCount(pushSpy);
    dispatchPopState(); // 추가 popstate.
    expect(guards.a.promptOpen).toBe(false);
    expect(sentinelPushCount(pushSpy)).toBe(after); // 재push 0.
  });

  // SC-T10 (정상) releaseAndNavigate → traversal 완료 후 navigate 정확히 1회.
  it('SC-T10: releaseAndNavigate는 뒤로가기 처리 후에만 navigate를 1번 실행한다', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    expect(nav).not.toHaveBeenCalled(); // 동기 즉시 X.
    expect(backSpy).toHaveBeenCalledTimes(1);
    dispatchPopState();
    expect(nav).toHaveBeenCalledTimes(1);
  });

  // SC-T11 (경계) releaseAndNavigate 후 목적지 뒤로가기 → stale sentinel 없이 clean.
  it('SC-T11: releaseAndNavigate 이탈 후 목적지에서 뒤로가기는 stale sentinel 없이 동작한다', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    dispatchPopState(); // traversal 완료.
    const after = sentinelPushCount(pushSpy);
    dispatchPopState(); // 목적지에서 뒤로가기.
    expect(guards.a.promptOpen).toBe(false); // 재오픈 0.
    expect(sentinelPushCount(pushSpy)).toBe(after); // 재push 0(clean).
  });

  // SC-T12 (경계) router state(location key 등) 보존(spread merge).
  it('SC-T12: 기존 router history.state 필드가 sentinel push 후에도 보존된다', () => {
    act(() => {
      window.history.replaceState({ key: 'router-key-123', idx: 7 }, '', window.location.href);
    });
    render(<Probe when={true} />);
    const state = window.history.state as Record<string, unknown>;
    expect(state.key).toBe('router-key-123'); // router 필드 생존.
    expect(state.idx).toBe(7);
    expect(state[SENTINEL_KEY]).toBeDefined(); // sentinel 마커 동시 존재.
  });

  // SC-T13 (예외) 중첩 가드 → 두 번째 passive + DEV 경고.
  it('SC-T13: 같은 entry에 두 번째 가드가 마운트되면 passive이고 DEV 경고를 출력한다', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Probe id="a" when={true} />
        <Probe id="b" when={true} />
      </>,
    );
    // 두 번째는 자기 sentinel을 push하지 않음(owner 1개만).
    expect(sentinelPushCount(pushSpy)).toBe(1);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0]).toContain('useExitGuard');
  });

  // SC-T14 (예외) passive 인스턴스 popstate no-op, owner만 반응.
  it('SC-T14: passive(비소유) 인스턴스는 popstate에 반응하지 않고 owner만 차단한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Probe id="a" when={true} />
        <Probe id="b" when={true} />
      </>,
    );
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true); // owner 반응.
    expect(guards.b.promptOpen).toBe(false); // passive no-op.
  });

  // SC-T15 (예외) confirmExit 중복 popstate → onConfirmExit 1회.
  it('SC-T15: 나가기 중 뒤로가기 신호가 2번 와도 onConfirmExit은 1번만 호출된다', () => {
    const onConfirm = vi.fn();
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    dispatchPopState();
    act(() => guards.a.confirmExit());
    dispatchPopState();
    dispatchPopState();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // SC-T16 (경계) double-back → 둘 다 차단, 이탈 안 됨.
  it('SC-T16: 뒤로가기를 연속 2번 눌러도 두 번 다 차단된다', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
    expect(sentinelPushCount(pushSpy)).toBe(3); // arm 1 + 재push 2.
    expect(backSpy).not.toHaveBeenCalled(); // 나가지지 않음.
  });

  // SC-T17 (정상) confirmExit 후 목적지 뒤로가기 → clean.
  it('SC-T17: 나가기 이탈 후 목적지에서 뒤로가기는 stale sentinel 없이 동작한다', () => {
    const onConfirm = vi.fn();
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    dispatchPopState();
    act(() => guards.a.confirmExit());
    dispatchPopState(); // traversal 완료.
    const after = sentinelPushCount(pushSpy);
    dispatchPopState(); // 목적지 뒤로가기.
    expect(guards.a.promptOpen).toBe(false);
    expect(sentinelPushCount(pushSpy)).toBe(after);
  });

  // SC-T18 (경계) releaseAndNavigate 소유 sentinel 없음 → 즉시 1회.
  it('SC-T18: 소유 sentinel이 없으면 releaseAndNavigate는 대기 없이 navigate를 즉시 1번 실행한다', () => {
    render(<Probe when={false} />); // arm 안 함 → 비소유.
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    expect(nav).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T19 (예외) releaseAndNavigate 누락/중복 popstate → navigate 정확히 1회.
  it('SC-T19a: releaseAndNavigate 중 popstate 누락 시 fallback으로 navigate 1번', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    vi.useFakeTimers();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    expect(nav).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(nav).toHaveBeenCalledTimes(1);
  });

  it('SC-T19b: releaseAndNavigate 중 popstate가 2번 와도 navigate 1번', () => {
    render(<Probe when={true} />);
    dispatchPopState();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    dispatchPopState();
    dispatchPopState();
    expect(nav).toHaveBeenCalledTimes(1);
  });

  // SC-T20 (경계) 내부 push 후 언마운트 → 소유권 skip, back 미호출.
  it('SC-T20: 내부 navigate로 새 라우트 push 후 언마운트되어도 history.back을 부르지 않는다', () => {
    const { unmount } = render(<Probe when={true} />);
    // 내부 navigate가 새 entry(다른 마커) push.
    act(() => {
      window.history.pushState({ some: 'route' }, '', window.location.href);
    });
    unmount();
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T21 (경계) 프로그램적 redirect 후 언마운트 → back 미호출.
  it('SC-T21: 프로그램적 redirect 후 언마운트되어도 history.back을 부르지 않는다', () => {
    const { unmount } = render(<Probe when={true} />);
    act(() => {
      window.history.pushState({ redirected: true }, '', window.location.href);
    });
    unmount();
    expect(backSpy).not.toHaveBeenCalled();
  });

  // SC-T22 (경계, bounded) 통제 remount → 재arm idempotent(마운트당 ≤1).
  it('SC-T22: 생 navigate 후 가드 화면 remount 시 재arm은 마운트당 sentinel 1개만 push한다', () => {
    const first = render(<Probe id="a" when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(1);
    first.unmount(); // 미조정 이탈 — stale sentinel은 state에 남고 active에서 제거.
    const before = sentinelPushCount(pushSpy);
    render(<Probe id="b" when={true} />); // stale entry에 remount.
    const remountPushes = sentinelPushCount(pushSpy) - before;
    expect(remountPushes).toBe(1); // 마운트당 ≤1, 무한 중복 0.
    expect(guards.b.promptOpen).toBe(false);
  });

  // SC-T23 (예외, 재진입) confirmExit cb가 마운트 유지 중 추가 동작해도 재오픈·재push 0.
  it.each([
    ['history.back', () => window.history.back()],
    ['location.assign 모사(no-op)', () => {}],
    ['지연 navigate', () => setTimeout(() => {}, 0)],
  ])('SC-T23(%s): 이탈 cb가 마운트 유지 중 동작해도 prompt 재오픈 0·재push 0', (_label, cbAction) => {
    const onConfirm = vi.fn(cbAction);
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    dispatchPopState();
    act(() => guards.a.confirmExit());
    dispatchPopState(); // back 완료 → cb 실행(cbAction 수행).
    const after = sentinelPushCount(pushSpy);
    dispatchPopState(); // cb의 추가 동작이 유발할 수 있는 popstate.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(guards.a.promptOpen).toBe(false); // 재오픈 0.
    expect(sentinelPushCount(pushSpy)).toBe(after); // 재push 0.
  });

  // SC-T24 (예외, 소유권-skip) 마커가 다른 uid면 양 진입점 모두 back 미호출·cb 1회.
  it('SC-T24a: 마커가 다른 uid면 confirmExit은 back 없이 onConfirmExit을 1번만 호출한다', () => {
    const onConfirm = vi.fn();
    render(<Probe when={true} onConfirmExit={onConfirm} />);
    act(() => {
      // 소유권 마커가 다른 uid로 바뀜.
      window.history.replaceState({ ...window.history.state, [SENTINEL_KEY]: 'other-uid' }, '', window.location.href);
    });
    act(() => guards.a.confirmExit());
    expect(backSpy).not.toHaveBeenCalled(); // 비소유 → skip.
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('SC-T24b: 마커가 다른 uid면 releaseAndNavigate는 back 없이 navigate를 1번만 실행한다', () => {
    render(<Probe when={true} />);
    act(() => {
      window.history.replaceState({ ...window.history.state, [SENTINEL_KEY]: 'other-uid' }, '', window.location.href);
    });
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    expect(backSpy).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledTimes(1);
  });

  // SC-T13c (예외, 버전-스큐 — codex high) 타 번들의 활성 sentinel은 덮어쓰지 않고 passive.
  it('SC-T13c: 레지스트리에 있는 외부(타 번들) 활성 마커는 덮어쓰지 않고 passive가 된다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // 다른 번들/버전이 이미 이 entry를 소유한 상황을 모사: window-global 레지스트리에 외부 uid 등록 + 마커 설정.
    (window as unknown as ExitGuardWindow).__tmExitGuardOwners!.add('foreign-bundle-uid');
    act(() => {
      window.history.replaceState({ [SENTINEL_KEY]: 'foreign-bundle-uid' }, '', window.location.href);
    });
    render(<Probe when={true} />);
    // 내 sentinel을 push하지 않고(덮어쓰기 0), 마커는 외부 소유 그대로 유지.
    expect(sentinelPushCount(pushSpy)).toBe(0);
    expect((window.history.state as Record<string, unknown>)[SENTINEL_KEY]).toBe('foreign-bundle-uid');
    // passive → popstate에 반응하지 않음(외부 owner만 반응).
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(false);
  });

  // SC-T8b (예외, 버전-스큐 beforeunload — codex medium) owner release 후 passive는 beforeunload를 막지 않는다.
  it('SC-T8b: owner가 이탈 확정하면 passive(비소유) 가드는 beforeunload를 막지 않는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Probe id="a" when={true} />
        <Probe id="b" when={true} />
      </>,
    );
    // release 전: owner(a)가 beforeunload 차단.
    const e1 = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e1, 'returnValue', { writable: true, value: '' });
    act(() => {
      window.dispatchEvent(e1);
    });
    expect(e1.defaultPrevented).toBe(true);
    // owner 이탈 확정.
    act(() => guards.a.confirmExit());
    // release 후: owner는 released, passive(b)는 비소유 → 어느 쪽도 차단 안 함.
    const e2 = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e2, 'returnValue', { writable: true, value: '' });
    act(() => {
      window.dispatchEvent(e2);
    });
    expect(e2.defaultPrevented).toBe(false);
  });

  // SC-T19c (예외, late popstate — codex high) fallback이 먼저 떠도 늦은 traversal이 무해하게 흡수, cb 정확히 1회.
  it('SC-T19c: fallback이 cb를 실행한 뒤 늦은 popstate가 와도 navigate는 1번·재arm 없음', () => {
    render(<Probe when={true} />);
    dispatchPopState(); // 모달 + owns.
    vi.useFakeTimers();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    act(() => {
      vi.advanceTimersByTime(60); // fallback 발화 → nav 1회.
    });
    expect(nav).toHaveBeenCalledTimes(1);
    const after = sentinelPushCount(pushSpy);
    dispatchPopState(); // fallback 이후 늦게 도착한 실제 traversal.
    expect(nav).toHaveBeenCalledTimes(1); // 여전히 정확히 1회(latch).
    expect(guards.a.promptOpen).toBe(false); // 재오픈 0.
    expect(sentinelPushCount(pushSpy)).toBe(after); // 재push/재arm 0.
  });

  // SC-T19d (예외, late popstate 물리 위치 복원 — codex high) 늦은 traversal이 URL을 옮기면 목적지로 best-effort 복원.
  it('SC-T19d: fallback 후 늦은 traversal이 URL을 목적지에서 옮기면 best-effort로 복원한다', () => {
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    const base = window.location.href;
    vi.useFakeTimers();
    const nav = vi.fn(() => {
      window.history.pushState({}, '', `${base}?dest=1`); // cb가 목적지로 이동.
    });
    act(() => guards.a.releaseAndNavigate(nav));
    act(() => {
      vi.advanceTimersByTime(60); // fallback 발화 → nav → URL=목적지.
    });
    expect(window.location.search).toContain('dest=1');
    // 늦게 도착한 브라우저 traversal이 URL을 목적지에서 옮긴 상황 모사.
    act(() => {
      window.history.replaceState({}, '', base);
    });
    dispatchPopState(); // late popstate → best-effort 복원.
    expect(nav).toHaveBeenCalledTimes(1); // cb는 여전히 1회.
    expect(window.location.search).toContain('dest=1'); // 목적지 URL 복원.
  });

  // SC-T19e (예외, throwing cb 복구 — codex R3 leak·R5 finding1) cb가 throw하면 listener 정리 + 가드 복구.
  it('SC-T19e: 이탈 cb가 throw하면 (마운트·when=true) listener를 정리하고 가드를 복구해 다시 보호한다', () => {
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    vi.useFakeTimers();
    const nav = vi.fn(() => {
      throw new Error('boom');
    });
    act(() => guards.a.releaseAndNavigate(nav));
    // fallback 발화 시 cb throw → 흡수 컨트롤러 정리 + 가드 복구 후 에러 표면화.
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(60);
      }),
    ).toThrow('boom');
    expect(nav).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    // 복구됨: beforeunload가 다시 차단(가드 재가동).
    const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e, 'returnValue', { writable: true, value: '' });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(true);
    // 복구됨: 뒤로가기가 다시 모달을 띄움.
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
  });

  // SC-T19e2 (경계, 언마운트 후 복구 안 함) cb가 throw해도 이미 언마운트된 인스턴스는 재arm하지 않는다.
  it('SC-T19e2: cb가 throw해도 언마운트된 인스턴스는 가드를 복구(재push)하지 않는다', () => {
    const view = render(<Probe when={true} />);
    dispatchPopState(); // owns.
    vi.useFakeTimers();
    const nav = vi.fn(() => {
      view.unmount(); // 라우트 전환으로 언마운트.
      throw new Error('boom');
    });
    act(() => guards.a.releaseAndNavigate(nav));
    const before = sentinelPushCount(pushSpy);
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(60);
      }),
    ).toThrow('boom');
    expect(sentinelPushCount(pushSpy)).toBe(before); // 죽은 인스턴스 재arm 0.
  });

  // SC-T19g (경계, 귀속 경계 — codex R5 finding2) grace 경과 후의 무관한 popstate는 흡수·복원하지 않는다.
  it('SC-T19g: grace 경과 후 도착한 무관한 popstate는 목적지로 하이재킹하지 않는다(의도적 귀속 경계)', () => {
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    const base = window.location.href;
    vi.useFakeTimers();
    const nav = vi.fn(() => {
      window.history.pushState({}, '', `${base}?dest=3`); // 목적지로 이동.
    });
    act(() => guards.a.releaseAndNavigate(nav));
    act(() => {
      vi.advanceTimersByTime(60); // fallback → nav → 목적지.
    });
    expect(window.location.search).toContain('dest=3');
    act(() => {
      vi.advanceTimersByTime(250); // grace 경과 → 흡수 listener teardown.
    });
    // 이후 사용자의 무관한 네비게이션이 URL을 옮기고 popstate 발생.
    act(() => {
      window.history.replaceState({}, '', base);
    });
    dispatchPopState();
    expect(nav).toHaveBeenCalledTimes(1);
    // grace 경과 후엔 복원 안 함 → 사용자의 새 위치 유지(오래된 목적지로 하이재킹 0).
    expect(window.location.search).not.toContain('dest=3');
  });

  // SC-T19f (예외, navigate-unmount lifecycle — codex R4 high) fallback navigate가 훅을 언마운트해도 흡수·복원 생존.
  it('SC-T19f: fallback navigate가 훅을 언마운트해도 늦은 popstate가 흡수·복원된다', () => {
    const view = render(<Probe when={true} />);
    dispatchPopState(); // owns.
    const base = window.location.href;
    vi.useFakeTimers();
    const nav = vi.fn(() => {
      window.history.pushState({}, '', `${base}?dest=2`); // 목적지로 이동.
      view.unmount(); // 실제 releaseAndNavigate처럼 라우트 전환이 이 훅을 언마운트.
    });
    act(() => guards.a.releaseAndNavigate(nav));
    act(() => {
      vi.advanceTimersByTime(60); // fallback → nav → 목적지 이동 + 언마운트.
    });
    expect(window.location.search).toContain('dest=2');
    // 언마운트 후 늦게 도착한 traversal이 URL을 옮긴 상황 — release 흡수 컨트롤러가 생존해 복원해야 함.
    act(() => {
      window.history.replaceState({}, '', base);
    });
    dispatchPopState(); // late popstate(언마운트 이후).
    expect(nav).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain('dest=2'); // 언마운트가 흡수 listener를 죽이지 않음 → 복원됨.
  });

  // SC-T19h (예외, async 거부 복구 — codex R6 high) owned 경로: async cb가 reject돼도 가드를 복구한다.
  it('SC-T19h: 이탈 콜백이 async로 reject되면 (owned) 가드를 복구해 다시 보호한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    const nav = vi.fn(() => Promise.reject(new Error('async-fail')));
    act(() => guards.a.releaseAndNavigate(nav));
    dispatchPopState(); // traversal → runCb → cb가 거부 promise 반환.
    await act(async () => {
      await Promise.resolve(); // 거부 microtask flush → 복구.
    });
    expect(nav).toHaveBeenCalledTimes(1);
    // 복구됨: 뒤로가기가 다시 모달을 띄움.
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
  });

  // SC-T19h2 (예외, async 거부 복구 non-owned — codex R6 high) 비소유 경로도 async reject 시 복구한다.
  it('SC-T19h2: async reject 시 non-owned(소유권-skip) 경로도 가드를 복구한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Probe when={true} />); // owns, marker=내 uid.
    act(() => {
      // 마커가 다른 uid로 → release가 비소유 경로(즉시 cb).
      window.history.replaceState({ ...window.history.state, [SENTINEL_KEY]: 'other-uid' }, '', window.location.href);
    });
    const nav = vi.fn(() => Promise.reject(new Error('async-fail')));
    act(() => guards.a.releaseAndNavigate(nav)); // owns=false → 즉시 cb(거부 promise).
    expect(backSpy).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(nav).toHaveBeenCalledTimes(1);
    // 복구됨(armSentinel 재push) → 뒤로가기 다시 차단.
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
  });

  // SC-T19i (예외, StrictMode 재마운트 후 async 복구 — codex R7 medium) 더블마운트 후에도 복구 동작.
  it('SC-T19i: StrictMode 재마운트 후에도 async reject 시 가드를 복구한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <Probe when={true} />
      </StrictMode>,
    );
    dispatchPopState(); // owns(재마운트 사이클 후 marker===uid 재소유).
    const nav = vi.fn(() => Promise.reject(new Error('async-fail')));
    act(() => guards.a.releaseAndNavigate(nav));
    dispatchPopState(); // traversal → runCb → cb 거부 promise.
    await act(async () => {
      await Promise.resolve();
    });
    expect(nav).toHaveBeenCalledTimes(1);
    // mountedRef가 setup마다 복원돼 복구 활성 → 뒤로가기 다시 모달.
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true);
  });

  // SC-T19j (예외, async 성공+late popstate — codex R9 high) async cb가 await 후 네비게이션해도 stale URL로 yank 안 함.
  it('SC-T19j: async cb가 await 후 네비게이션하면 late popstate가 가드 URL로 되돌리지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    const base = window.location.href;
    vi.useFakeTimers();
    let navigated = false;
    const nav = vi.fn(async () => {
      await Promise.resolve(); // 비동기 경계 — 네비게이션은 await 이후(promise 반환 시점엔 아직 가드 URL).
      window.history.pushState({}, '', `${base}?dest=async`);
      navigated = true;
    });
    act(() => guards.a.releaseAndNavigate(nav));
    act(() => {
      vi.advanceTimersByTime(60); // fallback → cb() 호출(promise 반환, intendedHref=null).
    });
    // microtask flush → cb가 네비게이션 + promise settle → intendedHref=목적지로 기록.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(navigated).toBe(true);
    expect(window.location.search).toContain('dest=async');
    // grace 안에서 late popstate 도착 → 목적지로 기록됐으므로 stale 가드 URL로 yank 0.
    dispatchPopState();
    expect(window.location.search).toContain('dest=async'); // 목적지 유지(가드 URL로 안 돌아감).
  });

  // SC-T19k (예외, fail-closed 관측 — codex R10) fallback 발화 시 DEV 경고로 비정상 상황을 드러낸다.
  it('SC-T19k: fallback이 발화하면(=traversal 미관측) DEV 경고를 출력한다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Probe when={true} />);
    dispatchPopState(); // owns.
    vi.useFakeTimers();
    const nav = vi.fn();
    act(() => guards.a.releaseAndNavigate(nav));
    expect(warnSpy).not.toHaveBeenCalled(); // 아직 fallback 전.
    act(() => {
      vi.advanceTimersByTime(60); // fallback 발화.
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('useExitGuard');
    expect(nav).toHaveBeenCalledTimes(1);
  });

  // SC-T19m (예외, 실패 복구 소유권-인지 — codex R11 finding1 high) passive 인스턴스의 release가 async reject돼도
  // 외부 활성 owner 마커를 덮어쓰지 않는다(계약위반 방지).
  it('SC-T19m: passive 인스턴스의 release가 async reject돼도 외부 활성 owner 마커를 가로채지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // 외부(타 번들) 활성 owner가 이 entry를 소유한 상황.
    (window as unknown as ExitGuardWindow).__tmExitGuardOwners!.add('foreign-bundle-uid');
    act(() => {
      window.history.replaceState({ [SENTINEL_KEY]: 'foreign-bundle-uid' }, '', window.location.href);
    });
    render(<Probe when={true} />); // 외부 마커 소유 → passive.
    expect(sentinelPushCount(pushSpy)).toBe(0); // 마운트 시 덮어쓰기 0.
    const nav = vi.fn(() => Promise.reject(new Error('async-fail')));
    act(() => guards.a.releaseAndNavigate(nav)); // owns=false → 즉시 cb(거부 promise).
    expect(backSpy).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve(); // 거부 microtask flush → restoreOnFailure.
    });
    expect(nav).toHaveBeenCalledTimes(1);
    // 실패 복구가 소유권-인지: 외부 owner 마커 그대로, 내 sentinel push 0(계약 유지).
    expect((window.history.state as Record<string, unknown>)[SENTINEL_KEY]).toBe('foreign-bundle-uid');
    expect(sentinelPushCount(pushSpy)).toBe(0);
  });

  // SC-T19n (예외, 실패 후 latch 해제 — codex R11 finding2 high) clean 상태에서 release가 실패하면 release latch를
  // 무조건 해제해, 이후 when=false→true(다시 dirty)에서 가드가 정상 재가동된다(data-loss 갭 방지).
  it('SC-T19n: clean 상태에서 release가 reject된 뒤 다시 dirty(when=true)가 되면 가드가 재가동된다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<Probe when={false} />); // clean → arm 안 함(비소유).
    expect(sentinelPushCount(pushSpy)).toBe(0);
    const nav = vi.fn(() => Promise.reject(new Error('async-fail')));
    act(() => guards.a.releaseAndNavigate(nav)); // clean release → owns=false, 즉시 cb(거부 promise).
    expect(backSpy).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve(); // reject flush → restoreOnFailure가 latch 해제(when=false라 즉시 arm은 보류).
    });
    expect(nav).toHaveBeenCalledTimes(1);
    // 이후 편집으로 dirty(when=true) → latch가 stuck이 아니므로 arm effect가 가드를 다시 켠다.
    rerender(<Probe when={true} />);
    expect(sentinelPushCount(pushSpy)).toBe(1); // 새 sentinel push(latch 해제 확인).
    dispatchPopState();
    expect(guards.a.promptOpen).toBe(true); // 뒤로가기 다시 차단.
  });

  // SC-T1b (정상, StrictMode idempotent) 더블마운트에도 sentinel은 1개만(중복 push 0).
  it('SC-T1b: StrictMode 더블마운트에도 sentinel은 1번만 push된다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <Probe when={true} />
      </StrictMode>,
    );
    expect(sentinelPushCount(pushSpy)).toBe(1); // 재마운트 시 marker===uid 재소유(재push 0).
  });
});
