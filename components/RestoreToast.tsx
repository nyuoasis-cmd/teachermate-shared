import { useEffect, useState } from 'react';

export type RestoreToastSource = 'local' | 'server' | 'conflict';

export interface RestoreToastProps {
  source: RestoreToastSource;
  duration?: number;
  onAccept?: () => void;
  onDismiss?: () => void;
  onChoose?: (choice: 'local' | 'server') => void;
}

const MESSAGE: Record<RestoreToastSource, string> = {
  local: '이전 작성 내용을 복원했어요',
  server: '이전에 저장한 내용을 불러왔어요',
  conflict: '다른 곳에서 더 최근에 저장됐어요. 이걸 쓸까요?',
};

export function RestoreToast({
  source,
  duration = 5000,
  onAccept,
  onDismiss,
  onChoose,
}: RestoreToastProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (source === 'conflict' || hidden) return;
    const timer = window.setTimeout(() => {
      setHidden(true);
      onDismiss?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [source, duration, hidden, onDismiss]);

  if (hidden) return null;

  if (source === 'conflict') {
    return (
      <div
        role="alertdialog"
        aria-live="assertive"
        className="flex min-w-[280px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-lg"
        data-restore-source="conflict"
      >
        <p className="text-sm font-medium">{MESSAGE.conflict}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              onChoose?.('local');
              setHidden(true);
            }}
            className="rounded-md border border-amber-700/30 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            현재 기기 내용 사용
          </button>
          <button
            type="button"
            onClick={() => {
              onChoose?.('server');
              setHidden(true);
            }}
            className="rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
          >
            서버 내용 사용
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-[240px] max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-white shadow-lg"
      data-restore-source={source}
    >
      <p className="flex-1 text-sm">{MESSAGE[source]}</p>
      <button
        type="button"
        onClick={() => {
          onAccept?.();
          setHidden(true);
        }}
        className="shrink-0 rounded-md border border-white/25 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
      >
        확인
      </button>
    </div>
  );
}
