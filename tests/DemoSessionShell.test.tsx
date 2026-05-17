// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionShell, useDemoSession } from '../components/DemoSessionShell';

afterEach(() => {
  cleanup();
});

function Probe() {
  const { isDemo, demoCode, loading } = useDemoSession();
  return (
    <div data-testid="probe">
      {loading ? 'loading' : ''}|{isDemo ? 'demo' : 'off'}|{demoCode ?? '-'}
    </div>
  );
}

describe('DemoSessionShell', () => {
  it('renders children with isDemo=false when DB says off', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ is_demo: false }),
    }) as unknown as typeof fetch;

    render(
      <DemoSessionShell sessionCode="ABC123" fetchImpl={fetchImpl}>
        <Probe />
      </DemoSessionShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('|off|-');
    });
    expect(screen.queryByText('교사 시연 모드')).toBeNull();
  });

  it('shows demo sticky bar and demoCode when DB says on', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ is_demo: true }),
    }) as unknown as typeof fetch;

    render(
      <DemoSessionShell sessionCode="DEMO-1" fetchImpl={fetchImpl}>
        <Probe />
      </DemoSessionShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('|demo|DEMO-1');
    });
    expect(screen.getByText('교사 시연 모드')).toBeTruthy();
  });

  it('toggle(false) POSTs and hides sticky bar; rollback on failure', async () => {
    let isDemo = true;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init) {
        return { ok: true, json: async () => ({ is_demo: isDemo }) } as Response;
      }
      isDemo = false;
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    function Toggler() {
      const { isDemo: on, toggle } = useDemoSession();
      return (
        <button type="button" onClick={() => void toggle(!on)}>
          toggle
        </button>
      );
    }

    render(
      <DemoSessionShell sessionCode="X" fetchImpl={fetchImpl}>
        <Probe />
        <Toggler />
      </DemoSessionShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('|demo|X');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('toggle'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('|off|-');
    });
  });
});
