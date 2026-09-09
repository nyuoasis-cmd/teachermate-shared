import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface DemoSessionShellProps {
  sessionCode: string;
  showMirror?: boolean;
  children: ReactNode;
  fetchImpl?: typeof fetch;
  /**
   * 🚨 시연 데이터의 수명을 화면에 적는 문구. **앱마다 수명 정책이 다르다.**
   * 기본값은 「종료 시 지운다」인데, 끝내도 안 지우는 정책(예: usertest v1.11)을 쓰는 앱이
   * 이걸 그대로 두면 **화면이 거짓말을 한다**. 그런 앱은 자기 정책 문구를 반드시 넘긴다.
   * 빈 문자열을 주면 문구 자체를 뺀다.
   */
  dataLifetimeNote?: string;
}

/** 기본 문구 = 「종료 시 삭제」 정책. 이 부품의 원래 소비자들이 쓰던 값이라 기본값으로 남긴다. */
export const DEFAULT_DEMO_LIFETIME_NOTE = '데이터는 시연 종료 시 모두 삭제됩니다';

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

function DemoStickyBar({ onEnd, lifetimeNote }: { onEnd: () => void; lifetimeNote: string }) {
  return (
    <div className="demo-sticky" role="status" aria-live="polite" data-demo-bar="true">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <span aria-hidden="true">●</span>
          <span>교사 시연 모드</span>
          {lifetimeNote ? (
            <span className="text-xs text-amber-700" data-demo-lifetime-note="true">
              {lifetimeNote}
            </span>
          ) : null}
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
  dataLifetimeNote = DEFAULT_DEMO_LIFETIME_NOTE,
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
      {isDemo ? <DemoStickyBar onEnd={() => void toggle(false)} lifetimeNote={dataLifetimeNote} /> : null}
      {showMirror && isDemo ? <StudentMirror sessionCode={sessionCode} /> : null}
      {children}
    </DemoSessionContext.Provider>
  );
}
