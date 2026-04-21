import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { showToast } from './ToastContainer';
import { QRFullscreen } from './QRFullscreen';

export interface QRButtonProps {
  sessionCode: string;
  sessionTitle: string;
  joinUrl: string;
  variant: 'card-icon' | 'detail-button';
}

export function QRButton({ sessionCode, sessionTitle, joinUrl, variant }: QRButtonProps) {
  const [isCompactOpen, setIsCompactOpen] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const compactQrSize = 280;
  const ariaLabel = useMemo(() => `QR코드 보기 - ${sessionTitle}`, [sessionTitle]);

  useEffect(() => {
    if (!isCompactOpen) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(joinUrl, {
      width: compactQrSize,
      margin: 2,
    }).then((nextUrl) => {
      if (!cancelled) {
        setQrDataUrl(nextUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isCompactOpen, joinUrl]);

  useEffect(() => {
    if (!isCompactOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCompactOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCompactOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      showToast('참여 링크를 복사했어요.', 'success');
    } catch {
      showToast('링크 복사에 실패했어요.', 'error');
    }
  };

  return (
    <>
      {variant === 'card-icon' ? (
        <div className="group relative">
          <button
            type="button"
            aria-label={ariaLabel}
            title="QR코드"
            onClick={() => setIsCompactOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-transparent text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <QrCode className="h-6 w-6" />
          </button>
          <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm md:block md:opacity-0 md:transition md:group-hover:opacity-100">
            QR코드
          </span>
        </div>
      ) : (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={() => setIsFullscreenOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <QrCode className="h-5 w-5" />
          <span>QR 띄우기</span>
        </button>
      )}

      {isCompactOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => setIsCompactOpen(false)}
        >
          <div
            className="relative w-full max-w-[360px] rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setIsCompactOpen(false)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-stone-500 [word-break:keep-all]">{sessionTitle}</p>
              <div className="mt-4 overflow-hidden rounded-[28px] border border-stone-200 p-3 shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`${sessionTitle} 참여 QR 코드`}
                    width={compactQrSize}
                    height={compactQrSize}
                    className="rounded-[20px]"
                  />
                ) : (
                  <div className="h-[280px] w-[280px] animate-pulse rounded-[20px] bg-stone-100" />
                )}
              </div>
              <p className="mt-5 text-2xl font-bold tracking-[0.12em] text-stone-900">{sessionCode}</p>
              <button
                type="button"
                onClick={() => {
                  setIsCompactOpen(false);
                  setIsFullscreenOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-stone-700 underline underline-offset-4 transition hover:text-stone-900"
              >
                수업 중 크게 띄우기
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                <Copy className="h-4 w-4" />
                링크 복사
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <QRFullscreen
        open={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        sessionCode={sessionCode}
        sessionTitle={sessionTitle}
        joinUrl={joinUrl}
      />
    </>
  );
}
