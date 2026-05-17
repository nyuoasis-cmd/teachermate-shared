import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface DemoSessionShellProps {
  sessionCode: string;
  showMirror?: boolean;
  children: ReactNode;
  fetchImpl?: typeof fetch;
}

interface DemoSessionContextValue {
  isDemo: boolean;
  demoCode: string | null;
  toggle: (on: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function useDemoSession(): DemoSessionContextValue {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) {
    return { isDemo: false, demoCode: null, toggle: async () => {}, loading: false, error: null };
  }
  return ctx;
}

function DemoStickyBar({ onEnd }: { onEnd: () => void }) {
  return (
    <div className="demo-sticky" role="status" aria-live="polite" data-demo-bar="true">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <span aria-hidden="true">●</span>
          <span>교사 시연 모드</span>
          <span className="text-xs text-amber-700">데이터는 시연 종료 시 모두 삭제됩니다</span>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-md border border-amber-700/30 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          시연 종료
        </button>
      </div>
    </div>
  );
}

function StudentMirror({ sessionCode }: { sessionCode: string }) {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-900"
      data-student-mirror={sessionCode}
    >
      학생 화면 미러 (시연 모드)
    </div>
  );
}

export function DemoSessionShell({
  sessionCode,
  showMirror = false,
  children,
  fetchImpl = fetch,
}: DemoSessionShellProps) {
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchImpl(`/api/sessions/${encodeURIComponent(sessionCode)}/demo`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { is_demo?: boolean }) => {
        if (cancelled) return;
        setIsDemo(Boolean(d.is_demo));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'demo fetch failed');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionCode, fetchImpl]);

  const toggle = useCallback(
    async (on: boolean) => {
      const prev = isDemo;
      setIsDemo(on);
      try {
        const res = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionCode)}/demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_demo: on }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setError(null);
      } catch (e: unknown) {
        setIsDemo(prev);
        setError(e instanceof Error ? e.message : 'demo toggle failed');
        throw e;
      }
    },
    [sessionCode, fetchImpl, isDemo],
  );

  const value = useMemo<DemoSessionContextValue>(
    () => ({ isDemo, demoCode: isDemo ? sessionCode : null, toggle, loading, error }),
    [isDemo, sessionCode, toggle, loading, error],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {isDemo ? <DemoStickyBar onEnd={() => void toggle(false)} /> : null}
      {showMirror && isDemo ? <StudentMirror sessionCode={sessionCode} /> : null}
      {children}
    </DemoSessionContext.Provider>
  );
}
