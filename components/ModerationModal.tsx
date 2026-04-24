import { useEffect } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export type ModerationCategory = 'violence' | 'sexual' | 'hate' | 'self-harm' | 'personal-info' | 'other';

export interface ModerationResource {
  name: string;
  url: string;
  phone: string;
}

export interface ModerationModalProps {
  open: boolean;
  onClose: () => void;
  category: ModerationCategory;
  onReportToTeacher?: () => void;
  selfHarmResource?: ModerationResource;
}

interface ModerationCopy {
  title: string;
  description: string;
  guidance: string;
}

const CATEGORY_COPY: Record<ModerationCategory, ModerationCopy> = {
  violence: {
    title: '폭력적인 내용은 생성할 수 없어요',
    description: '다치게 하거나 위협하는 표현이 포함돼 있어요.',
    guidance: '장면을 더 안전하고 평화롭게 바꿔서 다시 시도해 주세요.',
  },
  sexual: {
    title: '성적인 내용은 생성할 수 없어요',
    description: '학생용 서비스에서 허용되지 않는 표현이 감지됐어요.',
    guidance: '교육 활동에 맞는 건강한 장면으로 바꿔 주세요.',
  },
  hate: {
    title: '혐오하거나 차별하는 내용은 생성할 수 없어요',
    description: '특정 사람이나 집단을 공격하는 표현이 포함돼 있어요.',
    guidance: '존중하는 말로 바꿔서 다시 시도해 주세요.',
  },
  'self-harm': {
    title: '도움이 필요한 신호가 보여요',
    description: '자해나 극단적 선택과 관련된 표현은 바로 생성할 수 없어요.',
    guidance: '혼자 견디지 말고 믿을 수 있는 어른이나 상담 자원에 바로 도움을 요청해 주세요.',
  },
  'personal-info': {
    title: '개인정보는 보호해야 해요',
    description: '전화번호, 주소, 계정 정보 같은 민감한 내용이 포함돼 있어요.',
    guidance: '실제 개인정보를 지우고 안전한 표현으로 바꿔 주세요.',
  },
  other: {
    title: '내용을 다시 확인해 주세요',
    description: '현재 입력은 바로 생성하기 어려워요.',
    guidance: '표현을 조금 바꾸거나 선생님과 함께 다시 확인해 주세요.',
  },
};

const DEFAULT_SELF_HARM_RESOURCE: ModerationResource = {
  name: '청소년상담1388',
  url: 'https://www.1388.go.kr',
  phone: '1388',
};

export default function ModerationModal({
  open,
  onClose,
  category,
  onReportToTeacher,
  selfHarmResource = DEFAULT_SELF_HARM_RESOURCE,
}: ModerationModalProps) {
  const copy = CATEGORY_COPY[category];
  const isSelfHarm = category === 'self-harm';

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] rounded-t-2xl rounded-b-none bg-white px-6 pt-6 shadow-lg md:w-[90%] md:rounded-xl"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', wordBreak: 'keep-all' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 pr-8">
          <div className={`mt-0.5 rounded-full p-2 ${isSelfHarm ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-stone-900">{copy.title}</h3>
            <p className="mt-1.5 text-sm text-stone-500">{copy.description}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-sm leading-6 text-stone-700">{copy.guidance}</p>
        </div>

        {isSelfHarm ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
            <p className="text-sm font-semibold text-rose-800">지금 바로 도움을 요청해도 괜찮아요.</p>
            <p className="mt-1 text-sm text-rose-700">
              {selfHarmResource.name} · {selfHarmResource.phone}
            </p>
            <a
              href={selfHarmResource.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-rose-800 underline underline-offset-4"
            >
              상담 자원 바로가기
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            닫기
          </button>
          {onReportToTeacher ? (
            <button
              type="button"
              onClick={onReportToTeacher}
              className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              선생님께 문의
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
