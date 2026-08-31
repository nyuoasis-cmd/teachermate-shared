import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import QRCode from 'qrcode';

export interface QRFullscreenProps {
  open: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionTitle: string;
  joinUrl: string;
  participantCount?: number;
}

/**
 * DESIGN-POLICY §10 v3 — QR 크기.
 *
 * 🚨 고정 px 상한을 두지 않는다. 이 화면은 교실 프로젝터로 쏘는 물건이라
 * 화면이 커지면 QR 도 같이 커져야 한다. v2 의 `min(38vw, 32vh, 280px)` 는
 * 폰(390×844)에서는 티가 안 났지만(280 vs 273) 프로젝터(1920×1080)에서
 * 280 vs 486 = 1.74× 로 조용히 잘렸다.
 *
 * 🔑 크기는 여기 한 곳에서만 정한다(§10 v3). TSX 의 size 와 CSS 의 svg width
 * 두 곳에 두면 한쪽만 고쳐도 화면이 안 바뀐다(brand 2026-08-07 실측 사고).
 */
export function qrSizeFor(viewportWidth: number, viewportHeight: number): number {
  const ratio = viewportWidth < 768 ? 0.7 : 0.45;
  return Math.round(Math.min(viewportWidth, viewportHeight) * ratio);
}

/**
 * 래스터 해상도는 «표시 크기» 와 다른 축이다(§10 v3).
 * 표시 크기만 키우면 「커졌는데 흐릿하다」로 결함이 모양만 바꾼다(plan 실측).
 * 표시 최대치를 덮도록 2배로 렌더한다.
 */
function qrRenderResolution(displaySize: number): number {
  return Math.min(2048, Math.max(512, displaySize * 2));
}

function readQRSize(): number {
  if (typeof window === 'undefined') return 512;
  return qrSizeFor(window.innerWidth, window.innerHeight);
}

export function QRFullscreen({
  open,
  onClose,
  sessionCode,
  sessionTitle,
  joinUrl,
  participantCount,
}: QRFullscreenProps) {
  const [qrSize, setQrSize] = useState(readQRSize);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    // 🚨 resize 리스너 필수(§10 v3) — 없으면 «열 때 크기» 로 굳는다.
    // 상한을 지워도 이게 없으면 교사가 창을 옮기거나 폰을 돌렸을 때 그대로다(data-class 실측).
    const updateSize = () => {
      setQrSize(readQRSize());
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(joinUrl, {
      width: qrRenderResolution(qrSize),
      margin: 3,
    }).then((nextUrl) => {
      if (!cancelled) {
        setQrDataUrl(nextUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [joinUrl, open, qrSize]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-fullscreen-title"
      aria-describedby="qr-fullscreen-hint"
      className="fixed inset-0 z-[100] overflow-auto"
      style={{ background: 'var(--color-surface)' }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="QR 코드 닫기"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full transition"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex min-h-full px-6 py-10" onClick={(event) => event.stopPropagation()}>
        {/*
          🚨 패널에 max-width 를 두지 않는다(§10 v3).
          「상한은 QR 에만 있지 않다」 — v2 의 max-w-[580px] 는 QR 상한을 지워도
          화면이 그대로이게 만드는 두 번째 상한이었다(kospi·architecture·plan 실측).
          세로 중앙정렬은 place-items:center 가 아니라 margin:auto — 넘칠 때 위가 잘리지 않게.
        */}
        <div className="m-auto flex w-full flex-col items-center text-center">
          <p
            id="qr-fullscreen-title"
            className="text-base [word-break:keep-all]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {sessionTitle}
          </p>

          <p
            className="mt-4 select-all text-[clamp(96px,18vw,200px)] font-bold leading-none tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
          >
            {sessionCode}
          </p>

          <div
            className="mt-8 overflow-hidden rounded-2xl p-4 shadow-lg"
            style={{
              width: qrSize + 32,
              height: qrSize + 32,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${sessionTitle} 참여 QR 코드`}
                className="h-full w-full rounded-xl"
              />
            ) : (
              <div
                className="h-full w-full animate-pulse rounded-xl"
                style={{ background: 'var(--color-surface-hover)' }}
              />
            )}
          </div>

          {typeof participantCount === 'number' ? (
            <div className="mt-8 flex items-center gap-3">
              <span
                className="h-3 w-3 animate-pulse rounded-full"
                style={{ background: 'var(--color-success-text)' }}
              />
              <span
                className="text-[clamp(24px,3vw,32px)] font-medium"
                style={{ color: 'var(--color-text-body)' }}
              >
                {participantCount}명 참여 중
              </span>
            </div>
          ) : null}

          <p
            id="qr-fullscreen-hint"
            className="mt-6 text-base [word-break:keep-all] sm:text-xl"
            style={{ color: 'var(--color-text-quaternary)' }}
          >
            QR 코드를 스캔하거나 코드를 입력하세요
          </p>

          {/* 참여 URL 전문 — QR 을 못 찍는 학생이 직접 칠 수 있게(BUILDER-UX §5) */}
          <p
            className="mt-3 break-all text-xs"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-quaternary)' }}
          >
            {joinUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
