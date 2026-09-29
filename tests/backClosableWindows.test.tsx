// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '../components/ConfirmModal';
import { ExitGuardModal } from '../components/ExitGuardModal';
import { FocusTrap } from '../components/FocusTrap';
import { QRButton } from '../components/QRButton';
import { QRFullscreen } from '../components/QRFullscreen';
import { CreateSessionModal } from '../components/sessions/CreateSessionModal';
import { useBackClosable } from '../hooks/useBackClosable';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,stub')) },
}));

/*
 * 공용 창 부품에 내장된 «뒤로가기 = 창만 닫힘»(§9.H-18 v2.4 표 첫 줄) 회귀 시험.
 * jsdom 은 history.back() 으로 실제 traversal 을 하지 않는다 → back 은 막고(호출 순서만 기록),
 * 「한 칸 아래로 내려가기」 는 traverseBack() 으로 손으로 재현한다(useBackClosable.test 와 같은 방식).
 */
let entries: unknown[];
let calls: string[];

function traverseBack() {
  entries.pop();
  const below = entries[entries.length - 1] ?? {};
  act(() => {
    window.history.replaceState(below, '', window.location.href);
    window.dispatchEvent(new PopStateEvent('popstate', { state: below }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  window.history.replaceState({ idx: 0 }, '', window.location.href);
  entries = [window.history.state];
  calls = [];
  const w = window as unknown as Record<string, unknown>;
  w.__tmBackClosableStack = [];
  w.__tmBackClosablePending = 0;
  w.__tmBackClosableDeferred = [];
  w.__tmBackClosableLate = 0;
  w.__tmExitGuardOwners = new Set();
  w.__tmExitGuardSeq = 0;
  const realPush = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, 'pushState').mockImplementation((state, unused, url) => {
    entries.push(state);
    calls.push('push');
    realPush(state, unused, url);
  });
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    calls.push('back');
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ConfirmModal — 뒤로가기 = 창만 닫힘', () => {
  it('W1: 열리면 칸 한 개, 뒤로가기 한 번에 onClose 1회', () => {
    const onClose = vi.fn();
    render(<ConfirmModal open onClose={onClose} onConfirm={() => {}} title="삭제할까요?" />);
    expect(entries.length).toBe(2);
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('W2: 처리 중(loading)에는 뒤로가기로 닫히지 않고, 처리가 끝나면 보호를 다시 건다', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ConfirmModal open loading onClose={onClose} onConfirm={() => {}} title="삭제할까요?" />);
    traverseBack();
    expect(onClose).not.toHaveBeenCalled();
    expect(calls).toEqual(['push']);
    rerender(<ConfirmModal open loading={false} onClose={onClose} onConfirm={() => {}} title="삭제할까요?" />);
    expect(calls).toEqual(['push', 'push']); // 다시 걸었다
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('W3: confirmNavigates = 창 칸을 먼저 치운 뒤(다음 틱)에 onConfirm — 이동해도 죽은 칸 없음 · 기다리는 동안 취소 잠김', () => {
    const onConfirm = vi.fn(() => {
      calls.push('confirm');
    });
    const onClose = vi.fn();
    render(
      <ConfirmModal open confirmNavigates onClose={onClose} onConfirm={onConfirm} title="나갈까요?" confirmLabel="나가기" />,
    );
    fireEvent.click(screen.getByText('나가기'));
    fireEvent.click(screen.getByText('취소')); // 기다리는 중 — 잠겨 있다
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled(); // 아직 칸이 안 치워졌다
    traverseBack(); // 우리가 부른 back 의 popstate 도착
    expect(onConfirm).not.toHaveBeenCalled(); // 그 popstate 를 나눠 주는 중에는 안 부른다
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(calls).toEqual(['push', 'back', 'confirm']);
  });

  it('W3b: 기본(confirmNavigates 없음)은 예전처럼 누르는 즉시 onConfirm — 기존 앱 호환', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal open onClose={() => {}} onConfirm={onConfirm} title="삭제할까요?" />);
    fireEvent.click(screen.getByText('삭제'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['push']);
  });

  it('W3c: confirmNavigates 인데 확인 뒤에도 창이 남으면(앱이 안 닫음·실패) 뒤로가기 보호를 다시 건다', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onClose = vi.fn(); // 앱이 open 을 안 내린다 — 창이 남는다
    render(<ConfirmModal open confirmNavigates onClose={onClose} onConfirm={onConfirm} title="나갈까요?" confirmLabel="나가기" />);
    fireEvent.click(screen.getByText('나가기'));
    traverseBack();
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['push', 'back', 'push']); // 다시 걸었다
    expect(onClose).toHaveBeenCalledTimes(1); // 확인 성공 때 한 번(앱이 무시)
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(2); // 이제 뒤로가기가 다시 창만 닫는다
  });

  it('W4: closeOnBack={false} 면 칸을 쌓지 않는다', () => {
    render(<ConfirmModal open closeOnBack={false} onClose={() => {}} onConfirm={() => {}} title="x" />);
    expect(entries.length).toBe(1);
  });

  it('W5: ExitGuardModal(뒤로가기가 연 창)은 뒤로가기를 가져가지 않는다', () => {
    render(<ExitGuardModal promptOpen confirmExit={() => {}} cancelExit={() => {}} />);
    expect(entries.length).toBe(1);
  });
});

describe('QRFullscreen · QRButton', () => {
  it('W6: QR 전체화면은 기본으로 뒤로가기에 닫히고, closeOnBack={false} 면 칸을 안 쌓는다', () => {
    const onClose = vi.fn();
    const props = { sessionCode: 'ABC123', sessionTitle: '1반', joinUrl: 'https://x/join' };
    const { rerender } = render(<QRFullscreen open onClose={onClose} {...props} />);
    traverseBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<QRFullscreen open={false} onClose={onClose} {...props} />);
    rerender(<QRFullscreen open closeOnBack={false} onClose={onClose} {...props} />);
    expect(entries.length).toBe(1);
  });

  it('W7: 작은 QR → 「크게 띄우기」(같은 순간 바꿔 끼우기) — 큰 창은 작은 창의 칸이 치워진 뒤에 쌓이고 살아남는다', () => {
    render(<QRButton sessionCode="ABC123" sessionTitle="1반" joinUrl="https://x/join" variant="card-icon" />);
    fireEvent.click(screen.getByLabelText('QR코드 보기 - 1반'));
    expect(entries.length).toBe(2); // 작은 창 칸
    fireEvent.click(screen.getByText('수업 중 크게 띄우기'));
    expect(calls).toEqual(['push', 'back']); // 큰 창의 push 는 아직 — back 을 기다린다
    traverseBack(); // 작은 창의 칸이 치워졌다 → 그제서야 큰 창이 칸을 쌓는다
    expect(calls).toEqual(['push', 'back', 'push']);
    expect(entries.length).toBe(2);
    expect(screen.getByRole('dialog')).toBeTruthy(); // 큰 창은 닫히지 않았다
    traverseBack(); // 이번 뒤로가기는 큰 창만 닫는다
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('FocusTrap — 앱이 켤 때만', () => {
  it('W8: 기본은 칸을 안 쌓는다(창이 아닌 곳에도 쓰이므로)', () => {
    render(<FocusTrap onEscape={() => {}}><button>a</button></FocusTrap>);
    expect(entries.length).toBe(1);
  });

  it('W9: closeOnBack 을 켜면 뒤로가기가 onEscape 를 부른다', () => {
    const onEscape = vi.fn();
    render(<FocusTrap closeOnBack onEscape={onEscape}><button>a</button></FocusTrap>);
    traverseBack();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe('CreateSessionModal', () => {
  it('W10: createNavigates = 창 칸을 먼저 치운 뒤에 onCreate (새 수업 화면으로 이동해도 죽은 칸 없음)', () => {
    const onCreate = vi.fn(() => {
      calls.push('create');
    });
    const onClose = vi.fn();
    render(<CreateSessionModal open createNavigates onClose={onClose} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('예: 3학년 2반 앱 만들기'), { target: { value: '1반' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' })); // 기다리는 중 — 잠겨 있다
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    traverseBack();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(calls).toEqual(['push', 'back', 'create']);
  });

  it('W10b: 기본은 예전처럼 누르는 즉시 onCreate — 기존 앱 호환', () => {
    const onCreate = vi.fn();
    render(<CreateSessionModal open onClose={() => {}} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('예: 3학년 2반 앱 만들기'), { target: { value: '1반' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe('useBackClosable — 기다림이 영영 막지 않는다', () => {
  function Swap() {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    useBackClosable(a, () => setA(false));
    useBackClosable(b, () => setB(false));
    return <button onClick={() => { setA(false); setB(true); }}>swap</button>;
  }

  it('W12: 새 창이 칸을 쌓기 전에 부른 closeThen 은 앞 창의 back 이 끝난 뒤에 이동한다', () => {
    let closer: ReturnType<typeof useBackClosable> | null = null;
    function SwapGo() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(false);
      useBackClosable(a, () => setA(false));
      closer = useBackClosable(b, () => setB(false));
      return <button onClick={() => { setA(false); setB(true); }}>swap</button>;
    }
    render(<SwapGo />);
    fireEvent.click(screen.getByText('swap'));
    const go = vi.fn(() => calls.push('go'));
    act(() => closer!.closeThen(go));
    expect(go).not.toHaveBeenCalled(); // A 의 back 이 아직 — 지금 이동하면 그 back 이 이동을 되돌린다
    traverseBack();
    expect(calls[calls.length - 1]).toBe('go');
  });

  it('W13: 한도를 넘겨 늦게 온 back 은 그 사이 연 새 창을 닫지 않는다', () => {
    const closedB = vi.fn();
    function Swap2() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(false);
      useBackClosable(a, () => setA(false));
      useBackClosable(b, () => { closedB(); setB(false); });
      return <button onClick={() => { setA(false); setB(true); }}>swap</button>;
    }
    render(<Swap2 />);
    fireEvent.click(screen.getByText('swap'));
    act(() => {
      vi.advanceTimersByTime(300); // 기다림 포기 → B 가 칸을 쌓는다
    });
    expect(calls).toEqual(['push', 'back', 'push']);
    // A 의 back 이 이제야 도착 — B 의 칸이 아니라 A 의 칸을 치운 결과로 보고 흡수한다
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });
    expect(closedB).not.toHaveBeenCalled();
  });

  it('W11: back 의 popstate 가 안 오는 기기 — 한도(300ms) 뒤에는 새 창이 칸을 쌓는다', () => {
    render(<Swap />);
    fireEvent.click(screen.getByText('swap'));
    expect(calls).toEqual(['push', 'back']);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(calls).toEqual(['push', 'back', 'push']);
  });
});
