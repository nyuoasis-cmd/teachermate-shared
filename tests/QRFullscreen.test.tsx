// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QRFullscreen, qrSizeFor } from '../components/QRFullscreen';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,stub')) },
}));

afterEach(() => {
  cleanup();
});

/**
 * DESIGN-POLICY §10 v3 회귀 시험.
 *
 * 🩸 이 시험들이 존재하는 이유 — v2 는 «폰에서 잘 보이니 됐다» 로 오래 안 잡혔다.
 * 폰에서는 상한 280 이 계산값 273 보다 커서 아무 일도 일어나지 않았고,
 * 프로젝터에서만 1.74× 로 잘렸다. 그래서 «큰 화면» 을 반드시 같이 잰다.
 */
describe('qrSizeFor — §10 v3 (고정 px 상한 없음)', () => {
  it('폰(390×844)은 짧은 변의 70%', () => {
    expect(qrSizeFor(390, 844)).toBe(273);
  });

  it('프로젝터(1920×1080)는 짧은 변의 45% — v2 의 280 상한이면 실패한다', () => {
    expect(qrSizeFor(1920, 1080)).toBe(486);
    expect(qrSizeFor(1920, 1080)).toBeGreaterThan(280);
  });

  it('화면이 커지면 QR 도 계속 커진다 (4K)', () => {
    expect(qrSizeFor(3840, 2160)).toBe(972);
  });

  it('상한이 없다 — 화면을 2배로 하면 QR 도 2배', () => {
    expect(qrSizeFor(3840, 2160)).toBe(qrSizeFor(1920, 1080) * 2);
  });

  it('768px 경계에서 비율이 갈린다 (모바일 0.7 / PC 0.45)', () => {
    expect(qrSizeFor(767, 2000)).toBe(Math.round(767 * 0.7));
    expect(qrSizeFor(768, 2000)).toBe(Math.round(768 * 0.45));
  });

  it('세로가 짧으면 세로를 따른다 (짧은 변 기준)', () => {
    expect(qrSizeFor(1920, 600)).toBe(270);
  });
});

describe('QRFullscreen — 패널 상한과 세로 넘침', () => {
  const props = {
    open: true,
    onClose: () => {},
    sessionCode: '7KQ4MZ',
    sessionTitle: '3학년 2반 앱 만들기',
    joinUrl: 'https://build.teachermate.co.kr/student/join?code=7KQ4MZ',
    participantCount: 12,
  };

  it('내용 패널에 max-width 상한이 없다', () => {
    // 🔑 「상한은 QR 에만 있지 않다」(§10 v3) — v2 의 max-w-[580px] 는
    // QR 상한을 지워도 화면이 그대로이게 만드는 두 번째 상한이었다.
    const { container } = render(<QRFullscreen {...props} />);
    const capped = container.querySelectorAll('[class*="max-w-"]');
    expect(capped.length).toBe(0);
  });

  it('세로 중앙정렬을 margin auto 로 준다 (넘칠 때 위가 잘리지 않게)', () => {
    const { container } = render(<QRFullscreen {...props} />);
    expect(container.querySelector('.m-auto')).not.toBeNull();
  });

  it('오버레이가 넘치는 내용을 스크롤한다', () => {
    const { container } = render(<QRFullscreen {...props} />);
    expect(container.querySelector('[role="dialog"]')?.className).toContain('overflow-auto');
  });

  it('코드·안내·참여 인원·참여 URL 을 모두 보여준다', () => {
    render(<QRFullscreen {...props} />);
    expect(screen.getByText('7KQ4MZ')).toBeTruthy();
    expect(screen.getByText('QR 코드를 스캔하거나 코드를 입력하세요')).toBeTruthy();
    expect(screen.getByText('12명 참여 중')).toBeTruthy();
    expect(screen.getByText(props.joinUrl)).toBeTruthy();
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    const { container } = render(<QRFullscreen {...props} open={false} />);
    expect(container.firstChild).toBeNull();
  });
});
