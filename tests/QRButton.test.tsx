// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QRButton } from '../components/QRButton';

afterEach(cleanup);

/** §10-A · BUILDER-UX §4-A — 상세 헤더 QR 은 목록 카드 QR 과 같은 버튼이다(D3·D9). */
describe('QRButton detail-button — §10-A 정본 규격', () => {
  it('「QR코드」 글씨 · 검정 채움 · 높이 44', () => {
    render(<QRButton sessionCode="ABC234" sessionTitle="수업" joinUrl="https://x/join" variant="detail-button" />);
    const btn = screen.getByRole('button', { name: /QR코드 보기/ });
    expect(btn.textContent).toBe('QR코드');
    expect(btn.style.background).toBe('var(--color-btn-primary)');
    expect(btn.style.height).toBe('44px');
    expect(screen.queryByText('QR 띄우기')).toBeNull();
  });
});
