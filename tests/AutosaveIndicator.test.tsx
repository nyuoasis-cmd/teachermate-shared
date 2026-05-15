// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutosaveIndicator } from '../components/AutosaveIndicator';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AutosaveIndicator', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<AutosaveIndicator status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "저장 중…" while saving with aria-live polite', () => {
    render(<AutosaveIndicator status="saving" />);
    const node = screen.getByRole('status');
    expect(node.textContent).toBe('저장 중…');
    expect(node.getAttribute('aria-live')).toBe('polite');
    expect(node.getAttribute('data-status')).toBe('saving');
  });

  it('shows "저장됨" when saved', () => {
    render(<AutosaveIndicator status="saved" />);
    expect(screen.getByRole('status').textContent).toBe('저장됨');
  });

  it('renders custom error message when status is error', () => {
    render(<AutosaveIndicator status="error" errorMessage="네트워크 오류" />);
    const node = screen.getByRole('status');
    expect(node.textContent).toBe('네트워크 오류');
    expect(node.getAttribute('data-status')).toBe('error');
  });

  it('calls onAutoHide after savedDuration when status is saved', () => {
    vi.useFakeTimers();
    const onAutoHide = vi.fn();
    render(<AutosaveIndicator status="saved" savedDuration={1500} onAutoHide={onAutoHide} />);
    expect(onAutoHide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1499);
    expect(onAutoHide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onAutoHide).toHaveBeenCalledTimes(1);
  });

  it('does not call onAutoHide when status is saving', () => {
    vi.useFakeTimers();
    const onAutoHide = vi.fn();
    render(<AutosaveIndicator status="saving" savedDuration={1500} onAutoHide={onAutoHide} />);
    vi.advanceTimersByTime(5000);
    expect(onAutoHide).not.toHaveBeenCalled();
  });

  it('uses inline positioning when position="inline"', () => {
    render(<AutosaveIndicator status="saving" position="inline" />);
    const node = screen.getByRole('status');
    expect(node.style.position).toBe('');
  });

  it('uses fixed positioning by default', () => {
    render(<AutosaveIndicator status="saving" />);
    const node = screen.getByRole('status');
    expect(node.style.position).toBe('fixed');
  });
});
