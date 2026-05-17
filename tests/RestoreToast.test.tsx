// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestoreToast } from '../components/RestoreToast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RestoreToast', () => {
  it('renders local restore message and auto-dismisses', () => {
    const onDismiss = vi.fn();
    render(<RestoreToast source="local" duration={3000} onDismiss={onDismiss} />);
    expect(screen.getByText('이전 작성 내용을 복원했어요')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders server restore message', () => {
    render(<RestoreToast source="server" />);
    expect(screen.getByText('이전에 저장한 내용을 불러왔어요')).toBeTruthy();
  });

  it('conflict variant does not auto-dismiss and calls onChoose', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<RestoreToast source="conflict" onChoose={onChoose} />);
    expect(screen.getByText('다른 곳에서 더 최근에 저장됐어요. 이걸 쓸까요?')).toBeTruthy();
    await user.click(screen.getByText('서버 내용 사용'));
    expect(onChoose).toHaveBeenCalledWith('server');
  });
});
