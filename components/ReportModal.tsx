import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Flag, HeartPulse, IdCard, Swords, UserX } from 'lucide-react';
import { showToast } from './ToastContainer';

export type ReportCategory = 'violence' | 'sexual' | 'hate' | 'self-harm' | 'personal-info' | 'other';

export interface ReportPayload {
  targetType: 'creation';
  targetId: string;
  category: ReportCategory;
  description: string;
  notifyReporter: boolean;
  reporterEmail?: string;
}

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  onSubmit: (payload: ReportPayload) => Promise<void>;
}

interface CategoryOption {
  value: ReportCategory;
  label: string;
  Icon: typeof Swords;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'violence', label: '폭력·위협', Icon: Swords },
  { value: 'sexual', label: '선정적·성적 내용', Icon: EyeOff },
  { value: 'hate', label: '혐오·차별', Icon: UserX },
  { value: 'self-harm', label: '자해·자살 위험', Icon: HeartPulse },
  { value: 'personal-info', label: '개인정보 노출', Icon: IdCard },
  { value: 'other', label: '기타', Icon: Flag },
];

const DEFAULT_CATEGORY: ReportCategory = 'other';

export function ReportModal({ open, onClose, targetId, onSubmit }: ReportModalProps) {
  const [category, setCategory] = useState<ReportCategory>(DEFAULT_CATEGORY);
  const [description, setDescription] = useState('');
  const [notifyReporter, setNotifyReporter] = useState(false);
  const [reporterEmail, setReporterEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCategory(DEFAULT_CATEGORY);
      setDescription('');
      setNotifyReporter(false);
      setReporterEmail('');
      setEmailError(null);
      setIsSubmitting(false);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose, open]);

  const isSelfHarm = category === 'self-harm';
  const emailRequired = notifyReporter;
  const isValidEmail = !emailRequired || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail.trim());

  const submitLabel = useMemo(() => (isSubmitting ? '보내는 중...' : '신고 보내기'), [isSubmitting]);

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isValidEmail) {
      setEmailError('이메일을 확인해주세요');
      return;
    }

    setEmailError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        targetType: 'creation',
        targetId,
        category,
        description: description.trim(),
        notifyReporter,
        reporterEmail: notifyReporter ? reporterEmail.trim() : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '신고하지 못했어요';
      showToast(message, 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-[440px] rounded-t-2xl rounded-b-none bg-white px-6 pt-6 shadow-lg md:w-[92%] md:rounded-xl"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', wordBreak: 'keep-all' }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          disabled={isSubmitting}
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="pr-8 text-[17px] font-semibold text-stone-900">신고 내용을 알려주세요</h3>
        <p className="mt-1.5 text-sm text-stone-500">운영 검토에 필요한 정보만 간단히 적어주세요</p>

        <div className="mt-5 grid gap-2">
          {CATEGORY_OPTIONS.map(({ value, label, Icon }) => {
            const checked = category === value;
            const isDanger = value === 'self-harm';
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                  checked
                    ? isDanger
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-stone-300 bg-stone-50 text-stone-900'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="report-category"
                  value={value}
                  checked={checked}
                  disabled={isSubmitting}
                  onChange={() => setCategory(value)}
                  className="sr-only"
                />
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    checked
                      ? isDanger
                        ? 'bg-red-100 text-red-700'
                        : 'bg-stone-200 text-stone-700'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </label>
            );
          })}
        </div>

        {isSelfHarm ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-sm font-semibold text-red-700">위험 신호가 보이면 바로 도움을 요청해주세요</p>
            <p className="mt-1 text-sm text-red-700">청소년상담 1388에서 24시간 상담을 받을 수 있어요</p>
          </div>
        ) : null}

        <div className="mt-4">
          <label className="text-sm font-medium text-stone-700" htmlFor="report-description">
            자세한 설명
          </label>
          <textarea
            id="report-description"
            value={description}
            disabled={isSubmitting}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="운영 검토에 필요한 내용을 적어주세요"
            className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-300"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
          <label className="flex items-center gap-3 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={notifyReporter}
              disabled={isSubmitting}
              onChange={(event) => {
                const checked = event.target.checked;
                setNotifyReporter(checked);
                if (!checked) {
                  setEmailError(null);
                }
              }}
              className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-300"
            />
            처리 결과를 이메일로 받을게요
          </label>
          <input
            type="email"
            value={reporterEmail}
            disabled={!notifyReporter || isSubmitting}
            onChange={(event) => setReporterEmail(event.target.value)}
            placeholder="이메일 주소"
            className="mt-3 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100"
          />
          {emailError ? <p className="mt-2 text-sm text-red-600">{emailError}</p> : null}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
