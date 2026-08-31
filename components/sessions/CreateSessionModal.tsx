import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FocusTrap } from '../FocusTrap';

/**
 * 수업 만들기 모달 — BUILDER-UX §4.
 *
 * 확정 사항(2026-08-31 결재):
 * - 제목 「수업 만들기」 · 설명 「수업 이름을 입력하면 참여 코드가 자동 발급돼요」
 * - 버튼 취소(왼쪽, 약한 것) → 만들기(오른쪽, 강한 것) · 44px(D9)
 * - 닫기 = X · 배경 클릭 · ESC 셋 다 (DESIGN-POLICY §7)
 * - confirm()/alert() 금지
 */

export interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  /** 수업 이름을 받아 만든다. 실패는 앱이 토스트로 알린다. */
  onCreate: (title: string) => void | Promise<void>;
  /** 만드는 중 — 버튼을 잠그고 「만드는 중...」으로 바꾼다. */
  creating?: boolean;
  placeholder?: string;
  /** 앱 고유 입력칸(studio 수업 종류 등)을 이름칸 아래에 끼워 넣는다. */
  children?: React.ReactNode;
}

export function CreateSessionModal({
  open,
  onClose,
  onCreate,
  creating = false,
  placeholder = '예: 3학년 2반 앱 만들기',
  children,
}: CreateSessionModalProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle('');
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !creating;

  const submit = () => {
    if (!canSubmit) return;
    void onCreate(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(28, 25, 23, 0.45)' }}
      onClick={onClose}
    >
      <FocusTrap>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-session-title"
          className="w-full max-w-[400px] p-6 shadow-lg"
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card-workspace)',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="create-session-title"
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                수업 만들기
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                수업 이름을 입력하면 참여 코드가 자동 발급돼요
              </p>
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="mt-5 block text-[13px] font-medium" style={{ color: 'var(--color-text-body)' }}>
            수업 이름
            <input
              ref={inputRef}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
              placeholder={placeholder}
              className="mt-1.5 w-full px-3.5 text-sm outline-none"
              style={{
                height: '48px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-btn-workspace)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>

          {children}

          {/* 왼쪽 약한 것, 오른쪽 강한 것 */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 text-sm font-medium transition-colors"
              style={{
                height: '44px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-btn-workspace)',
                background: 'transparent',
                color: 'var(--color-text-body)',
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="px-5 text-sm font-medium transition-colors"
              style={{
                height: '44px',
                borderRadius: 'var(--radius-btn-workspace)',
                background: 'var(--color-btn-primary)',
                color: 'var(--color-surface)',
                opacity: canSubmit ? 1 : 0.45,
              }}
            >
              {creating ? '만드는 중...' : '만들기'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
