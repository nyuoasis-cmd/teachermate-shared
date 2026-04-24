import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export interface RetryButtonProps {
  onRetry: () => Promise<void>;
  attemptsUsed: number;
  maxAttempts?: number;
  lastError?: string;
  disabled?: boolean;
}

export default function RetryButton({
  onRetry,
  attemptsUsed,
  maxAttempts = 3,
  lastError,
  disabled = false,
}: RetryButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const limitReached = attemptsUsed >= maxAttempts;
  const isDisabled = disabled || isLoading || limitReached;

  const helperText = limitReached
    ? '재시도 한도를 모두 사용했어요. 선생님께 문의해 주세요.'
    : lastError
      ? lastError
      : `${Math.max(maxAttempts - attemptsUsed, 0)}번 더 시도할 수 있어요.`;

  const handleRetry = async () => {
    if (isDisabled) {
      return;
    }

    try {
      setIsLoading(true);
      await onRetry();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2" style={{ wordBreak: 'keep-all' }}>
      <button
        type="button"
        onClick={() => {
          void handleRetry();
        }}
        disabled={isDisabled}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-stone-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            다시 시도하는 중
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {limitReached ? '선생님께 문의' : '다시 시도하기'}
          </>
        )}
      </button>
      <p className={`text-xs ${limitReached ? 'text-rose-700' : 'text-stone-500'}`}>
        {`재시도 ${Math.min(attemptsUsed, maxAttempts)}/${maxAttempts}`}
        {helperText ? ` · ${helperText}` : ''}
      </p>
    </div>
  );
}
