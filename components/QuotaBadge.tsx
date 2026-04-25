import { useEffect, useRef, useState } from 'react';

const APP_LABELS = {
  'meta-character': '메타 캐릭터',
  'ar-storybook': 'AR 스토리북',
  'ai-music-video': 'AI 뮤직비디오',
} as const;

type SupportedApp = keyof typeof APP_LABELS;

interface QuotaApiResponse {
  usage_count?: number;
  limit_count?: number;
  usage?: number;
  limit?: number;
}

export interface QuotaBadgeProps {
  appName: SupportedApp;
  userId: string;
  month?: string;
  fetchEndpoint?: string;
  onLimitReached?: (usage: number, limit: number) => void;
  onClickRequestExpand?: () => void;
}

function getCurrentMonth() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? `${now.getFullYear()}`;
  const month = parts.find((part) => part.type === 'month')?.value ?? `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function normalizeQuota(response: QuotaApiResponse) {
  const usage = response.usage_count ?? response.usage ?? 0;
  const limit = response.limit_count ?? response.limit ?? 1000;
  return {
    usage,
    limit: limit > 0 ? limit : 1,
  };
}

export function QuotaBadge({
  appName,
  userId,
  month,
  fetchEndpoint = '/api/quota',
  onLimitReached,
  onClickRequestExpand,
}: QuotaBadgeProps) {
  const resolvedMonth = month ?? getCurrentMonth();
  const [quota, setQuota] = useState({ usage: 0, limit: 1000 });
  const [isLoading, setIsLoading] = useState(true);
  const hasTriggeredLimitRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuota() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          appName,
          userId,
          month: resolvedMonth,
        });
        const response = await fetch(`${fetchEndpoint}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('쿼터를 불러오지 못했어요');
        }

        const payload = (await response.json()) as QuotaApiResponse;
        setQuota(normalizeQuota(payload));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setQuota({ usage: 0, limit: 1000 });
        if (error instanceof Error) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadQuota();
    return () => controller.abort();
  }, [appName, fetchEndpoint, resolvedMonth, userId]);

  useEffect(() => {
    const isAtLimit = quota.usage >= quota.limit;
    if (!isAtLimit) {
      hasTriggeredLimitRef.current = false;
      return;
    }

    if (hasTriggeredLimitRef.current) {
      return;
    }

    hasTriggeredLimitRef.current = true;
    onLimitReached?.(quota.usage, quota.limit);
  }, [onLimitReached, quota.limit, quota.usage]);

  const ratio = quota.limit === 0 ? 0 : quota.usage / quota.limit;
  const colorClassName =
    ratio >= 1
      ? 'bg-red-100 text-red-700'
      : ratio >= 0.8
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';
  const content = (
    <>
      <div className="flex flex-col">
        <span className="text-xs font-medium opacity-80">{APP_LABELS[appName]}</span>
        <span className="text-sm font-semibold">{isLoading ? '불러오는 중...' : `이번 달 ${quota.usage}/${quota.limit}`}</span>
      </div>
      {onClickRequestExpand ? <span className="text-xs font-medium opacity-80">한도 문의</span> : null}
    </>
  );

  const className = `inline-flex min-h-10 items-center gap-3 rounded-xl px-4 py-2 text-left transition ${
    onClickRequestExpand ? 'cursor-pointer hover:brightness-95' : ''
  } ${colorClassName}`;

  if (onClickRequestExpand) {
    return (
      <button
        type="button"
        onClick={onClickRequestExpand}
        className={className}
        style={{ wordBreak: 'keep-all' }}
        aria-label={`${APP_LABELS[appName]} 이번 달 사용량`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={{ wordBreak: 'keep-all' }} aria-label={`${APP_LABELS[appName]} 이번 달 사용량`}>
      {content}
    </div>
  );
}
