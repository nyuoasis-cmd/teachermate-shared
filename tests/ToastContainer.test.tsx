// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastContainer, showToast } from '../components/ToastContainer';

afterEach(() => {
  cleanup();
});

describe('ToastContainer §9.H-2 toast types', () => {
  it('renders success toast (default) with status role', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('저장됨');
    });
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('저장됨');
    expect(toast.className).toContain('bg-stone-900');
  });

  it('renders error toast with alert role', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('실패', { type: 'error' });
    });
    const toast = screen.getByRole('alert');
    expect(toast.textContent).toContain('실패');
    expect(toast.className).toContain('bg-red-600');
  });

  it('renders warning toast with alert role', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('주의 사항', { type: 'warning' });
    });
    const toast = screen.getByRole('alert');
    expect(toast.textContent).toContain('주의 사항');
    expect(toast.className).toContain('bg-amber-600');
  });

  it('renders info toast with status role', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('정보 알림', { type: 'info' });
    });
    const toasts = screen.getAllByRole('status');
    const info = toasts.find((t) => t.textContent?.includes('정보 알림'));
    expect(info).toBeTruthy();
    expect(info!.className).toContain('bg-sky-600');
  });

  it('accepts shorthand string for type', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('주의', 'warning');
    });
    const toast = screen.getByRole('alert');
    expect(toast.className).toContain('bg-amber-600');
  });

  it('caps queue length at 3 toasts (existing behavior preserved)', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('1', { type: 'info' });
      showToast('2', { type: 'info' });
      showToast('3', { type: 'info' });
      showToast('4', { type: 'info' });
    });
    const toasts = screen.getAllByRole('status');
    expect(toasts.length).toBe(3);
    expect(toasts.some((t) => t.textContent?.includes('1'))).toBe(false);
    expect(toasts.some((t) => t.textContent?.includes('4'))).toBe(true);
  });
});
