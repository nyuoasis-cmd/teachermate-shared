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

function getQRSize() {
  if (typeof window === 'undefined') return 280;
  const w38vw = window.innerWidth * 0.38;
  const h32vh = window.innerHeight * 0.32;
  return Math.round(Math.min(w38vw, h32vh, 280));
}

export function QRFullscreen({
  open,
  onClose,
  sessionCode,
  sessionTitle,
  joinUrl,
  participantCount,
}: QRFullscreenProps) {
  const [qrSize, setQrSize] = useState(() => (typeof window === 'undefined' ? 280 : getQRSize()));
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateSize = () => {
      setQrSize(getQRSize());
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => window.removeEventListener('resize', updateSize);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(joinUrl, {
      width: qrSize,
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
    <div className="fixed inset-0 z-[100] bg-white" onClick={onClose}>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="flex min-h-full items-center justify-center px-6 py-10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-full max-w-[580px] flex-col items-center text-center">
        <p className="text-[clamp(18px,2vw,24px)] text-stone-500 [word-break:keep-all]">{sessionTitle}</p>
        <p className="mt-4 font-mono text-[clamp(72px,15vw,112px)] font-bold tracking-[0.15em] text-stone-900 select-all">
          {sessionCode}
        </p>

        <div
          className="mt-8 overflow-hidden rounded-[28px] border border-stone-200 bg-white p-4 shadow-lg"
          style={{ width: qrSize + 32, height: qrSize + 32 }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`${sessionTitle} 참여 QR 코드`}
              className="h-full w-full rounded-[20px]"
              width={qrSize}
              height={qrSize}
            />
          ) : (
            <div className="h-full w-full animate-pulse rounded-[20px] bg-stone-100" />
          )}
        </div>

        {typeof participantCount === 'number' ? (
          <div className="mt-8 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[clamp(24px,3vw,32px)] font-medium text-stone-600">{participantCount}명 참여 중</span>
          </div>
        ) : null}

        <p className="mt-6 text-base text-stone-400 [word-break:keep-all] sm:text-xl">
          QR 코드를 스캔하거나 코드를 입력하세요
        </p>
        </div>
      </div>
    </div>
  );
}
