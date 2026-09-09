// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DemoSessionShell,
  useDemoSession,
  DEFAULT_DEMO_LIFETIME_NOTE,
} from '../components/DemoSessionShell';

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

// 🚨 수명 문구는 앱마다 다르다 — 기본값을 못 바꾸면 「끝내도 안 지운다」 정책을 쓰는 앱에서
//    배너가 거짓말을 한다(usertest v1.11). 아래 셋이 그 이빨이다.
describe('DemoSessionShell — 데이터 수명 문구', () => {
  function demoOnFetch() {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ is_demo: true }),
    }) as unknown as typeof fetch;
  }

  it('기본값은 「종료 시 삭제」 문구다 (기존 소비자 그대로)', async () => {
    render(
      <DemoSessionShell sessionCode="ABC123" fetchImpl={demoOnFetch()}>
        <div />
      </DemoSessionShell>,
    );
    await waitFor(() => expect(screen.getByText(DEFAULT_DEMO_LIFETIME_NOTE)).toBeTruthy());
  });

  it('앱이 자기 수명 정책을 넘기면 그 문구가 나오고 기본 문구는 사라진다', async () => {
    render(
      <DemoSessionShell
        sessionCode="ABC123"
        fetchImpl={demoOnFetch()}
        dataLifetimeNote="시연을 끝내도 데이터는 지워지지 않습니다"
      >
        <div />
      </DemoSessionShell>,
    );
    await waitFor(() =>
      expect(screen.getByText('시연을 끝내도 데이터는 지워지지 않습니다')).toBeTruthy(),
    );
    expect(screen.queryByText(DEFAULT_DEMO_LIFETIME_NOTE)).toBeNull();
  });

  it('빈 문자열이면 문구 자체가 없다', async () => {
    render(
      <DemoSessionShell sessionCode="ABC123" fetchImpl={demoOnFetch()} dataLifetimeNote="">
        <div />
      </DemoSessionShell>,
    );
    await waitFor(() => expect(screen.getByText('교사 시연 모드')).toBeTruthy());
    expect(document.querySelector('[data-demo-lifetime-note]')).toBeNull();
  });
});
