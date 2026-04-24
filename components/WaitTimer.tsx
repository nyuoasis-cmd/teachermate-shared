import { useEffect, useMemo, useState } from 'react';

export interface WaitTimerProps {
  startedAt: Date | number;
  estimatedSeconds?: number;
  stage?: string;
  tips?: string[];
}

const DEFAULT_ESTIMATED_SECONDS = 120;
const DEFAULT_STAGE = 'AI 생성 중';
const DEFAULT_TIPS = [
  '생성 시간이 조금 길어질 수 있어요. 잠시 쉬다 와도 괜찮아요.',
  '여러 학생이 함께 생성 중이면 평소보다 더 오래 걸릴 수 있어요.',
  '브라우저를 닫지 말고 잠시만 기다려 주세요.',
];

function toTimestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

export default function WaitTimer({
  startedAt,
  estimatedSeconds = DEFAULT_ESTIMATED_SECONDS,
  stage = DEFAULT_STAGE,
  tips = DEFAULT_TIPS,
}: WaitTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [startedAt]);

  const elapsedSeconds = Math.max(0, Math.floor((now - toTimestamp(startedAt)) / 1000));
  const remainingSeconds = Math.max(estimatedSeconds - elapsedSeconds, 0);
  const progressPercent = Math.min((elapsedSeconds / Math.max(estimatedSeconds, 1)) * 100, 100);
  const currentTip = useMemo(() => {
    if (tips.length === 0) {
      return DEFAULT_TIPS[0];
    }

    return tips[Math.floor(elapsedSeconds / 10) % tips.length];
  }, [elapsedSeconds, tips]);

  const headline = remainingSeconds > 0 ? `약 ${remainingSeconds}초 남았어요` : '조금만 더 기다려 주세요…';
  const subline =
    remainingSeconds > 0
      ? '보통 1~5분 안에 끝나요. 생성이 길어져도 정상일 수 있어요.'
      : '거의 마무리 중이에요. 창을 닫지 말고 잠시만 더 기다려 주세요.';

  return (
    <section
      aria-live="polite"
      className="rounded-[24px] border border-stone-200 bg-white p-5"
      style={{ wordBreak: 'keep-all' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">진행 상태</p>
          <h3 className="mt-2 text-lg font-semibold text-stone-900">{stage}</h3>
          <p className="mt-2 text-sm text-stone-600">{headline}</p>
        </div>
        <div className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
          {elapsedSeconds}초 경과
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-stone-800 transition-[width] duration-700"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-stone-500">{subline}</p>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold text-stone-700">안내</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">{currentTip}</p>
      </div>
    </section>
  );
}
