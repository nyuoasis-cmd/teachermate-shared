// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBeforeUnload } from '../hooks/useBeforeUnload';

afterEach(() => {
  cleanup();
});

function Probe({ isDirty, enabled }: { isDirty: boolean; enabled?: boolean }) {
  useBeforeUnload(isDirty, { enabled });
  return null;
}

function dispatchBeforeUnload(): BeforeUnloadEvent {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
  window.dispatchEvent(event);
  return event;
}

describe('useBeforeUnload', () => {
  it('does not block navigation when isDirty=false', () => {
    render(<Probe isDirty={false} />);
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('blocks navigation when isDirty=true', () => {
    render(<Probe isDirty={true} />);
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe('');
  });

  it('removes listener on unmount', () => {
    const { unmount } = render(<Probe isDirty={true} />);
    unmount();
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('respects enabled=false even when isDirty=true', () => {
    render(<Probe isDirty={true} enabled={false} />);
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('reattaches listener when isDirty toggles', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { rerender } = render(<Probe isDirty={false} />);
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    rerender(<Probe isDirty={true} />);
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });
});
