// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIosKeyboardScroll } from '../hooks/useIosKeyboardScroll';

const ORIGINAL_UA = window.navigator.userAgent;

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

function installVisualViewport(height: number) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: { height, offsetTop: 0 } as unknown as VisualViewport,
  });
}

function uninstallVisualViewport() {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
}

function Probe({ enabled, delayMs }: { enabled?: boolean; delayMs?: number }) {
  useIosKeyboardScroll({ enabled, delayMs });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setUserAgent(ORIGINAL_UA);
  uninstallVisualViewport();
});

describe('useIosKeyboardScroll', () => {
  it('does nothing on non-iOS user agents', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    installVisualViewport(800);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const spy = vi.fn();
    textarea.scrollIntoView = spy;

    render(<Probe />);
    fireEvent.focusIn(textarea);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    textarea.remove();
  });

  it('scrolls focused textarea into view on iOS when bottom is hidden', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari');
    installVisualViewport(400);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.getBoundingClientRect = () =>
      ({ top: 350, bottom: 450, left: 0, right: 200, width: 200, height: 100, x: 0, y: 350, toJSON: () => '' }) as DOMRect;
    const spy = vi.fn();
    textarea.scrollIntoView = spy;

    render(<Probe />);
    fireEvent.focusIn(textarea);
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    textarea.remove();
  });

  it('does not scroll when element is already in viewport', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Safari');
    installVisualViewport(800);

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.getBoundingClientRect = () =>
      ({ top: 100, bottom: 140, left: 0, right: 200, width: 200, height: 40, x: 0, y: 100, toJSON: () => '' }) as DOMRect;
    const spy = vi.fn();
    input.scrollIntoView = spy;

    render(<Probe />);
    fireEvent.focusIn(input);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores non-editable elements like buttons', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Safari');
    installVisualViewport(400);

    const button = document.createElement('button');
    document.body.appendChild(button);
    const spy = vi.fn();
    button.scrollIntoView = spy;

    render(<Probe />);
    fireEvent.focusIn(button);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    button.remove();
  });

  it('respects enabled=false', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Safari');
    installVisualViewport(400);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.getBoundingClientRect = () =>
      ({ top: 500, bottom: 600, left: 0, right: 0, width: 0, height: 0, x: 0, y: 500, toJSON: () => '' }) as DOMRect;
    const spy = vi.fn();
    textarea.scrollIntoView = spy;

    render(<Probe enabled={false} />);
    fireEvent.focusIn(textarea);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    textarea.remove();
  });

  it('no-ops gracefully when visualViewport is undefined', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Safari');
    uninstallVisualViewport();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const spy = vi.fn();
    textarea.scrollIntoView = spy;

    render(<Probe />);
    fireEvent.focusIn(textarea);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    textarea.remove();
  });
});
