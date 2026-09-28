// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackClosable, isBackConsumed } from '../hooks/useBackClosable';
import { useExitGuard, isFirstInAppEntry, type UseExitGuardReturn } from '../hooks/useExitGuard';

// jsdom 은 history.back() 으로 실제 traversal 을 하지 않는다 → back 을 막고, «한 칸 아래 state 로 내려가기» 를
// 손으로 재현한다(replaceState 로 아래 칸 state 를 되살린 뒤 popstate 발송). 쌓인 state 는 push 스파이가 기록한다.
let entries: unknown[];
let backSpy: ReturnType<typeof vi.spyOn>;
let guard: UseExitGuardReturn | null;

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
  useBackClosable(open, onClose);
  useBackClosable(open2, onClose2 ?? (() => {}));
  return null;
}

beforeEach(() => {
  guard = null;
  window.history.replaceState({ idx: 0 }, '', window.location.href);
  entries = [window.history.state];
  const w = window as unknown as Record<string, unknown>;
  w.__tmExitGuardOwners = new Set();
  w.__tmExitGuardSeq = 0;
  w.__tmBackClosableStack = [];
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
