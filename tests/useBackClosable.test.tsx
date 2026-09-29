// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackClosable, isBackConsumed, type BackClosable } from '../hooks/useBackClosable';
import { useExitGuard, isFirstInAppEntry, type UseExitGuardReturn } from '../hooks/useExitGuard';

// jsdom 은 history.back() 으로 실제 traversal 을 하지 않는다 → back 을 막고, «한 칸 아래 state 로 내려가기» 를
// 손으로 재현한다(replaceState 로 아래 칸 state 를 되살린 뒤 popstate 발송). 쌓인 state 는 push 스파이가 기록한다.
let entries: unknown[];
let backSpy: ReturnType<typeof vi.spyOn>;
let guard: UseExitGuardReturn | null;
let closer: BackClosable | null;

function traverseBack() {
  entries.pop();
  const below = entries[entries.length - 1] ?? {};
  act(() => {
    window.history.replaceState(below, '', window.location.href);
    window.dispatchEvent(new PopStateEvent('popstate', { state: below }));
  });
}

function Screen({ open, onClose, guardOn = false, open2 = false, onClose2 }: {
  open: boolean; onClose: () => void; guardOn?: boolean; open2?: boolean; onClose2?: () => void;
}) {
  guard = useExitGuard({ when: guardOn, onConfirmExit: () => {} });
  closer = useBackClosable(open, onClose);
  useBackClosable(open2, onClose2 ?? (() => {}));
  return null;
}

beforeEach(() => {
  guard = null;
  closer = null;
  window.history.replaceState({ idx: 0 }, '', window.location.href);
  entries = [window.history.state];
  const w = window as unknown as Record<string, unknown>;
  w.__tmExitGuardOwners = new Set();
  w.__tmExitGuardSeq = 0;
  w.__tmBackClosableStack = [];
  w.__tmBackClosablePending = 0;
  w.__tmBackClosableDeferred = [];
  w.__tmBackClosableLate = 0;
  const realPush = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, 'pushState').mockImplementation((state, unused, url) => {
    entries.push(state);
    realPush(state, unused, url);
  });
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBackClosable — 창이 열린 채 뒤로가기 = 창만 닫힘 (§9.H-18 v2.4)', () => {
  it('BC1: 창이 열리면 같은 주소로 기록 한 칸을 쌓고, 뒤로가기 한 번에 onClose 1회', () => {
    const onClose = vi.fn();
    render(<Screen open={true} onClose={onClose} />);
    expect(entries.length).toBe(2);
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('BC2: 첫 화면(가드 켜짐)에서 QR 열기 → 뒤로가기 1회 = QR 만 닫힘 → 1회 더 = 나가기 확인창 하나', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Screen open={false} onClose={onClose} guardOn={true} />);
    rerender(<Screen open={true} onClose={onClose} guardOn={true} />);
    traverseBack(); // 창 칸 소비
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(guard!.promptOpen).toBe(false); // 가드는 이 뒤로가기를 무시한다
    rerender(<Screen open={false} onClose={onClose} guardOn={true} />); // 앱이 onClose 로 open=false
    expect(backSpy).not.toHaveBeenCalled(); // 이미 뒤로가기로 치워진 칸 — 다시 back 하지 않는다
    traverseBack(); // 가드 sentinel 아래로
    expect(guard!.promptOpen).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('BC3: 버튼으로 닫으면 쌓아 둔 칸을 back 으로 치우고, 그 popstate 는 가드가 무시한다', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Screen open={false} onClose={onClose} guardOn={true} />);
    rerender(<Screen open={true} onClose={onClose} guardOn={true} />);
    rerender(<Screen open={false} onClose={onClose} guardOn={true} />); // X 버튼
    expect(backSpy).toHaveBeenCalledTimes(1);
    traverseBack(); // 우리가 부른 back 의 결과
    expect(guard!.promptOpen).toBe(false);
    expect(onClose).not.toHaveBeenCalled(); // 앱이 이미 닫았다 — 다시 부르지 않는다
  });

  it('BC4: 창이 두 겹이면 뒤로가기는 맨 위 창만 닫는다', () => {
    const c1 = vi.fn(), c2 = vi.fn();
    const { rerender } = render(<Screen open={true} onClose={c1} />);
    rerender(<Screen open={true} onClose={c1} open2={true} onClose2={c2} />);
    traverseBack();
    expect(c2).toHaveBeenCalledTimes(1);
    expect(c1).not.toHaveBeenCalled();
    rerender(<Screen open={true} onClose={c1} open2={false} onClose2={c2} />);
    traverseBack();
    expect(c1).toHaveBeenCalledTimes(1);
  });

  it('BC5: 창 안에서 replace 이동으로 칸이 바뀐 뒤 닫히면 back 을 부르지 않는다(엉뚱한 화면으로 가지 않음)', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Screen open={true} onClose={onClose} />);
    window.history.replaceState({ idx: 0 }, '', window.location.href); // navigate(to, {replace:true}) 모사
    rerender(<Screen open={false} onClose={onClose} />);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('BC6: 창이 없으면 가드는 예전처럼 뒤로가기에 확인창을 띄운다(회귀)', () => {
    render(<Screen open={false} onClose={() => {}} guardOn={true} />);
    traverseBack();
    expect(guard!.promptOpen).toBe(true);
  });

  it('BC7: 소비 표시는 이벤트 객체에만 붙는다(다음 뒤로가기에 새지 않음)', () => {
    const e = new PopStateEvent('popstate');
    expect(isBackConsumed(e)).toBe(false);
    expect(isBackConsumed(undefined)).toBe(false);
  });
});


// 부모 가드 + 자식 창 — React 는 자식 effect 를 먼저 돌린다(창 칸 위에 가드 sentinel 이 쌓인다).
function Child({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackClosable(open, onClose);
  return null;
}
function Parent({ open, onClose }: { open: boolean; onClose: () => void }) {
  guard = useExitGuard({ when: true, onConfirmExit: () => {} });
  return <Child open={open} onClose={onClose} />;
}

describe('useBackClosable — codex 2026-09-28 지적 3건', () => {
  it('BC8: 가드가 창보다 늦게 붙어도(부모 가드·자식 창 동시 마운트) 첫 뒤로가기는 창만 닫는다', () => {
    const onClose = vi.fn();
    render(<Parent open={true} onClose={onClose} />);
    expect(entries.length).toBe(3); // 페이지 · 창 칸 · 가드 sentinel(창 칸 위)
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(guard!.promptOpen).toBe(false);
  });

  it('BC9: closeThen — 창 칸을 치운 «뒤에» 이동한다(replace 로 깊이를 물려받지 않게)', () => {
    const onClose = vi.fn();
    const go = vi.fn();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<Screen open={true} onClose={onClose} />);
    act(() => closer!.closeThen(go));
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled(); // popstate 전에는 이동하지 않는다
    traverseBack();
    expect(go).not.toHaveBeenCalled(); // 그 popstate 를 나눠 주는 중에는 이동하지 않는다(다음 틱)
    act(() => { vi.advanceTimersByTime(0); });
    expect(go).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.history.state?.__tmBackClosable).toBeUndefined(); // 창 칸 위가 아니다 → push 는 페이지 위에 쌓인다
  });

  it('BC10: closeThen — back 의 popstate 가 안 와도 이동은 멈추지 않는다', () => {
    vi.useFakeTimers();
    const go = vi.fn();
    render(<Screen open={true} onClose={() => {}} />);
    act(() => closer!.closeThen(go));
    act(() => { vi.advanceTimersByTime(400); });
    expect(go).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('BC11: 아래 창만 먼저 닫으면 그 칸은 위 창이 닫힐 때 같이 치워진다(헛누르는 칸 없음)', () => {
    const c1 = vi.fn(), c2 = vi.fn();
    const { rerender } = render(<Screen open={true} onClose={c1} guardOn={false} />);
    rerender(<Screen open={true} onClose={c1} open2={true} onClose2={c2} />);
    rerender(<Screen open={false} onClose={c1} open2={true} onClose2={c2} />); // 메뉴(아래)만 닫음
    expect(backSpy).not.toHaveBeenCalled(); // 위 창이 있어 지금은 못 치운다
    traverseBack(); // 뒤로가기 1: 위 창(QR) 닫힘 + 아래 빈 칸에 섰다 → 한 칸 더 back
    expect(c2).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
    traverseBack(); // 그 back 의 결과 — 페이지 칸
    expect(entries.length).toBe(1);
    expect(c1).not.toHaveBeenCalled();
  });

  it('BC13: 가드와 창 두 개가 함께 열리고 아래 창부터 닫혀도 — 뒤로가기 1 = 위 창 닫힘 · 2 = 나가기 확인', () => {
    vi.useFakeTimers();
    const c1 = vi.fn(), c2 = vi.fn();
    function Two({ o1 }: { o1: boolean }) {
      guard = useExitGuard({ when: true, onConfirmExit: () => {} });
      return <><Child open={o1} onClose={c1} /><Child open={true} onClose={c2} /></>;
    }
    const { rerender } = render(<Two o1={true} />); // 자식 창 두 칸 위에 가드 sentinel
    rerender(<Two o1={false} />); // 아래 창만 닫음 → 빈 칸
    traverseBack(); // 1
    expect(c2).toHaveBeenCalledTimes(1);
    expect(guard!.promptOpen).toBe(false);
    act(() => { vi.advanceTimersByTime(200); }); // 창 정리 뒤 가드가 sentinel 을 다시 깐다
    traverseBack(); // 2
    expect(guard!.promptOpen).toBe(true);
    vi.useRealTimers();
  });

  it('BC12: 빈 칸 치우기의 popstate 는 가드가 무시한다(확인창이 튀지 않는다)', () => {
    const c1 = vi.fn(), c2 = vi.fn();
    const { rerender } = render(<Screen open={false} onClose={c1} guardOn={true} />);
    rerender(<Screen open={true} onClose={c1} guardOn={true} />);
    rerender(<Screen open={true} onClose={c1} guardOn={true} open2={true} onClose2={c2} />);
    rerender(<Screen open={false} onClose={c1} guardOn={true} open2={true} onClose2={c2} />);
    traverseBack();
    traverseBack();
    expect(guard!.promptOpen).toBe(false);
    traverseBack(); // 이제 가드 sentinel 아래 = 첫 화면 뒤로가기
    expect(guard!.promptOpen).toBe(true);
  });
});

describe('isFirstInAppEntry — «첫 화면» 판정', () => {
  it('FE1: react-router idx 0 = 첫 화면 · idx 2 = 아님 · idx 없음 = 첫 화면(모르면 확인창 쪽)', () => {
    window.history.replaceState({ idx: 0 }, '');
    expect(isFirstInAppEntry()).toBe(true);
    window.history.replaceState({ idx: 2 }, '');
    expect(isFirstInAppEntry()).toBe(false);
    window.history.replaceState(null, '');
    expect(isFirstInAppEntry()).toBe(true);
  });
});
