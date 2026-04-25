import { useState } from 'react';
import { Flag } from 'lucide-react';
import { showToast } from './ToastContainer';
import { ReportModal, type ReportPayload } from './ReportModal';

export interface ReportButtonProps {
  targetType: 'creation';
  targetId: string;
  apiEndpoint?: string;
  onSubmitted?: () => void;
  size?: 'sm' | 'md';
}

export type { ReportModalProps, ReportPayload } from './ReportModal';

export function ReportButton({
  targetType,
  targetId,
  apiEndpoint = '/api/reports',
  onSubmitted,
  size = 'md',
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  const sizeClassName = size === 'sm' ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm';

  const handleSubmit = async (payload: ReportPayload) => {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = '신고하지 못했어요';
      try {
        const errorPayload = (await response.json()) as { message?: string };
        if (errorPayload.message) {
          message = errorPayload.message;
        }
      } catch {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
      throw new Error(message);
    }

    showToast('신고를 접수했어요');
    onSubmitted?.();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white font-medium text-stone-600 transition hover:bg-stone-50 ${sizeClassName}`}
      >
        <Flag className="h-4 w-4" />
        신고하기
      </button>
      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        targetId={targetId}
        onSubmit={async (payload) => {
          if (targetType !== 'creation') {
            throw new Error('지원하지 않는 신고 대상이에요');
          }
          await handleSubmit(payload);
        }}
      />
    </>
  );
}
