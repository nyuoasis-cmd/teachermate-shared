// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCmdEnter } from '../hooks/useCmdEnter';

afterEach(() => {
  cleanup();
});

function Probe({
  onSubmit,
  enabled,
}: {
  onSubmit: () => void;
  enabled?: boolean;
}) {
  useCmdEnter(onSubmit, { enabled });
  return null;
}

function ScopedProbe({ onSubmit }: { onSubmit: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useCmdEnter(onSubmit, { targetRef: ref });
  return (
    <div ref={ref} data-testid="scope">
      <button>btn</button>
    </div>
  );
}

describe('useCmdEnter', () => {
  it('fires onSubmit on Meta+Enter (macOS)', () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('fires onSubmit on Ctrl+Enter (Windows/Linux)', () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not fire on Enter alone', () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not fire on Cmd+other key', () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    fireEvent.keyDown(document, { key: 'S', metaKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not fire when enabled=false', () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} enabled={false} />);
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cleans up listener on unmount', () => {
    const onSubmit = vi.fn();
    const { unmount } = render(<Probe onSubmit={onSubmit} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('respects targetRef scope — fires only when event originates inside ref', () => {
    const onSubmit = vi.fn();
    const { getByTestId } = render(<ScopedProbe onSubmit={onSubmit} />);
    const scope = getByTestId('scope');
    fireEvent.keyDown(scope, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
