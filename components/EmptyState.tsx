import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Archive,
  FolderPlus,
  ImageIcon,
  ImagePlus,
  SearchX,
  Sparkles,
  WifiOff,
} from 'lucide-react';

export type EmptyStateContext =
  | 'no-sessions'
  | 'no-creations'
  | 'no-search-results'
  | 'no-ai-generations'
  | 'error'
  | 'offline'
  | 'empty-gallery'
  | 'no-ended-sessions'
  | 'custom';

export interface EmptyStateProps {
  context: EmptyStateContext;
  title?: string;
  description?: string;
  cta?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  customIcon?: LucideIcon;
}

interface EmptyStatePreset {
  icon: LucideIcon;
  title: string;
  description: string;
}

const EMPTY_STATE_PRESETS: Record<Exclude<EmptyStateContext, 'custom'>, EmptyStatePreset> = {
  'no-sessions': {
    icon: FolderPlus,
    title: '아직 만든 수업이 없어요',
    description: '수업을 만들면 학생들이 참여할 수 있어요',
  },
  'no-creations': {
    icon: ImagePlus,
    title: '아직 작품이 없어요',
    description: '첫 작품을 만들어볼까요?',
  },
  'no-search-results': {
    icon: SearchX,
    title: '검색 결과가 없어요',
    description: '다른 말로 검색해보세요',
  },
  'no-ai-generations': {
    icon: Sparkles,
    title: '아직 생성한 게 없어요',
    description: '원하는 것을 만들어볼까요?',
  },
  error: {
    icon: AlertCircle,
    title: '문제가 발생했어요',
    description: '잠시 후 다시 시도해보세요',
  },
  offline: {
    icon: WifiOff,
    title: '연결을 확인해주세요',
    description: '인터넷 연결이 불안정해요',
  },
  'empty-gallery': {
    icon: ImageIcon,
    title: '아직 공개된 작품이 없어요',
    description: '첫 공개 작품의 주인공이 되어보세요',
  },
  'no-ended-sessions': {
    icon: Archive,
    title: '종료된 수업이 없어요',
    description: '진행 중인 수업만 있어요',
  },
};

export function EmptyState({ context, title, description, cta, customIcon }: EmptyStateProps) {
  const preset =
    context === 'custom'
      ? {
          icon: customIcon ?? FolderPlus,
          title: title ?? '',
          description: description ?? '',
        }
      : EMPTY_STATE_PRESETS[context];

  const Icon = customIcon && context === 'custom' ? customIcon : preset.icon;

  // 한결 v1 정합 (DESIGN-POLICY §8 빈 상태 4세트):
  // - 44px 원형 아이콘 컨테이너 (정책 명시 사이즈)
  // - 한결 토큰 var() 사용, Tailwind primitive class 0건
  // - hover는 onMouseEnter/Leave (shared 컴포넌트에서 :hover CSS 한계 회피)
  const isSecondary = cta?.variant === 'secondary';
  const ctaBaseStyle = isSecondary
    ? {
        border: '1px solid var(--color-border, #e7e5e4)',
        background: 'var(--color-surface, #ffffff)',
        color: 'var(--color-text-body, #57534e)',
      }
    : {
        border: 'none',
        background: 'var(--color-btn-primary, #1c1917)',
        color: 'var(--color-surface, #ffffff)',
      };

  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
      style={{ wordBreak: 'keep-all' }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: '44px',
          height: '44px',
          background: 'var(--color-surface-hover, #f5f5f4)',
        }}
      >
        <Icon
          style={{
            width: '20px',
            height: '20px',
            color: 'var(--color-text-quaternary, #a8a29e)',
          }}
        />
      </div>
      <h3
        className="mt-4 text-lg font-semibold"
        style={{ color: 'var(--color-text-primary, #1c1917)' }}
      >
        {title ?? preset.title}
      </h3>
      <p
        className="mt-2 max-w-md text-sm"
        style={{ color: 'var(--color-text-muted, #78716c)' }}
      >
        {description ?? preset.description}
      </p>
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-6 rounded-xl px-4 py-2 text-sm font-medium"
          style={{
            ...ctaBaseStyle,
            transition: 'background 150ms cubic-bezier(.2,.8,.2,1), border-color 150ms cubic-bezier(.2,.8,.2,1)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            if (isSecondary) {
              e.currentTarget.style.background = 'var(--color-surface-alt, #fafaf9)';
              e.currentTarget.style.borderColor = 'var(--color-border-hover, #d6d3d1)';
            } else {
              e.currentTarget.style.background = 'var(--color-btn-primary-hover, #292524)';
            }
          }}
          onMouseLeave={(e) => {
            if (isSecondary) {
              e.currentTarget.style.background = 'var(--color-surface, #ffffff)';
              e.currentTarget.style.borderColor = 'var(--color-border, #e7e5e4)';
            } else {
              e.currentTarget.style.background = 'var(--color-btn-primary, #1c1917)';
            }
          }}
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}
