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
    description: '잠시 후 다시 시도해주세요',
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

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center" style={{ wordBreak: 'keep-all' }}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-stone-100">
        <Icon className="h-12 w-12 text-stone-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title ?? preset.title}</h3>
      <p className="mt-2 max-w-md text-sm text-stone-500">{description ?? preset.description}</p>
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className={`mt-6 rounded-xl px-4 py-2 text-sm font-medium transition ${
            cta.variant === 'secondary'
              ? 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              : 'bg-stone-900 text-white hover:bg-stone-800'
          }`}
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}
