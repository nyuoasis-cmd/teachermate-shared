import { useCallback, useEffect, useRef, useState } from 'react';
import { useImeSafeInput } from '../../hooks/useImeSafeInput';

/**
 * 학생 입장 3단계 — BUILDER-UX §3 (E1~E12, 2026-08-31 결재).
 *
 *   1 코드 입력  →  2 이름 입력  →  3 완료 1.2초  →  앱 고유 화면
 *
 * 🚨 예외 없이 전 앱 이 세 화면이다(E1). 화면 수가 앱마다 다르면 교사의 안내 멘트가
 * 앱마다 달라진다 — 「코드 넣고 이름 적어」가 어느 앱에선 한 화면, 어느 앱에선 두 화면.
 *
 * 확정 근거: shared/mockups/hangyeol-v2-join-proposal-2026-08-31.html
 */

export type JoinFailureReason = 'notFound' | 'ended' | 'nameTaken' | 'network';

export type JoinResult = { ok: true; sessionTitle?: string } | { ok: false; reason: JoinFailureReason };

/** 오류 3종 문구 고정 (E8). 🩸 종료를 연결 오류로 말하면 학생이 무한 재시도한다. */
const ERROR_TEXT: Record<JoinFailureReason, { message: string; hint?: string }> = {
  notFound: { message: '수업을 찾을 수 없어요. 코드를 다시 확인해 주세요' },
  ended: { message: '이 수업은 종료되어 참여할 수 없어요', hint: '선생님께 새 코드를 받아 주세요' },
  nameTaken: { message: '이 이름은 이미 사용 중이에요. 이름 뒤에 번호를 붙여 주세요' },
  network: { message: '연결이 불안정해요. 다시 시도해 주세요' },
};

const CODE_LENGTH = 6;
const DONE_DELAY_MS = 1200;

/** 정규화 = 대문자 + 영숫자만. 적용 시점은 제출·blur·compositionEnd 뿐이다(E11). */
function normalizeCode(raw: string, numeric: boolean): string {
  const upper = raw.toUpperCase();
  const stripped = numeric ? upper.replace(/[^0-9]/g, '') : upper.replace(/[^A-Z0-9]/g, '');
  return stripped.slice(0, CODE_LENGTH);
}

export interface JoinFlowProps {
  /** QR 진입(`?code=`)으로 받은 코드. 주면 검증 후 이름 단계로 건너뛴다(E1). */
  initialCode?: string;
  /**
   * 코드 검증. 성공 시 sessionTitle 을 주면 이름 단계의 요약 pill 에 쓴다(E6).
   */
  onVerifyCode: (code: string) => Promise<JoinResult>;
  /** 이름 제출. 성공하면 완료 화면 → 1.2초 뒤 onDone. */
  onSubmitName: (name: string, code: string) => Promise<JoinResult>;
  /** 완료 화면 1.2초 후 호출 — 앱의 활동 화면으로 보낸다. */
  onDone: (name: string, code: string) => void;
  /** 「돌아가기」. 주지 않으면 그리지 않는다. */
  onCancel?: () => void;
  /** 숫자 6자 코드 앱(studio·profile) — placeholder 와 키패드가 바뀐다(E3·E4). */
  numericCode?: boolean;
  /** 동의가 필요한 앱(brand·profile) — 버튼이 「동의하고 참여하기」가 된다. */
  requiresConsent?: boolean;
  /** 이름칸 위에 끼워 넣을 앱 고유 내용(동의 문구 등). */
  consentNode?: React.ReactNode;
  /** 재방문 시 자동 입력할 이름. */
  initialName?: string;
}

export function JoinFlow({
  initialCode,
  onVerifyCode,
  onSubmitName,
  onDone,
  onCancel,
  numericCode = false,
  requiresConsent = false,
  consentNode,
  initialName = '',
}: JoinFlowProps) {
  const [step, setStep] = useState<'code' | 'name' | 'done'>('code');
  const [code, setCode] = useState(initialCode ? normalizeCode(initialCode, numericCode) : '');
  const [name, setName] = useState(initialName);
  const [sessionTitle, setSessionTitle] = useState<string | undefined>();
  const [error, setError] = useState<JoinFailureReason | null>(null);
  const [busy, setBusy] = useState(false);

  const submittedCodeRef = useRef<string | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verify = useCallback(
    async (raw: string) => {
      const value = normalizeCode(raw, numericCode);
      if (value.length !== CODE_LENGTH || busy) return;
      // 같은 코드로 자동 검증이 겹쳐 두 번 날아가지 않게(E5 자동 검증 + 버튼 병존)
      if (submittedCodeRef.current === value) return;
      submittedCodeRef.current = value;

      setCode(value);
      setBusy(true);
      setError(null);
      try {
        const result = await onVerifyCode(value);
        if (result.ok) {
          setSessionTitle(result.sessionTitle);
          setStep('name');
        } else {
          setError(result.reason);
          submittedCodeRef.current = null;
        }
      } catch {
        setError('network');
        submittedCodeRef.current = null;
      } finally {
        setBusy(false);
      }
    },
    [busy, numericCode, onVerifyCode],
  );

  // QR 진입이면 코드 단계에서 멈추지 않는다 — 프리필만 하고 세우는 것은 §3 금지(E1).
  const autoVerifiedRef = useRef(false);
  useEffect(() => {
    if (autoVerifiedRef.current || !initialCode) return;
    autoVerifiedRef.current = true;
    void verify(initialCode);
  }, [initialCode, verify]);

  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  const submitName = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmitName(trimmed, code);
      if (result.ok) {
        setStep('done');
        doneTimerRef.current = setTimeout(() => onDone(trimmed, code), DONE_DELAY_MS);
      } else {
        setError(result.reason);
      }
    } catch {
      setError('network');
    } finally {
      setBusy(false);
    }
  };

  // 🚨 onChange 에서 허용되는 것은 길이 자르기까지다(E11).
  // 대문자·영숫자 변환은 blur·compositionEnd·제출에서만 — 조합 중 되먹이면 한글이 사라진다.
  const codeInputHandlers = useImeSafeInput(
    (value) => setCode(value.slice(0, CODE_LENGTH)),
    undefined,
  );
  const nameInputHandlers = useImeSafeInput(setName, undefined);

  const errorText = error ? ERROR_TEXT[error] : null;
  const codeReady = normalizeCode(code, numericCode).length === CODE_LENGTH;

  if (step === 'done') {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center px-6 py-16 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'var(--color-success-bg)' }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-success-text)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p
          className="mt-6 text-2xl font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
          role="status"
        >
          {name.trim()}님, 시작해볼까요!
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          잠시 후 이동해요
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-6 py-12 text-center">
      {step === 'code' ? (
        <>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            수업 참여하기
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-body)' }}>
            선생님이 알려준 6자리 코드를 입력하세요
          </p>

          <input
            value={code}
            {...codeInputHandlers}
            onCompositionEnd={(event) => {
              codeInputHandlers.onCompositionEnd(event);
              setCode(normalizeCode((event.target as HTMLInputElement).value, numericCode));
            }}
            onBlur={(event) => setCode(normalizeCode(event.target.value, numericCode))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void verify(code);
            }}
            // E5 — 6자를 채우면 자동 검증. 단 아래 버튼과 병존한다.
            onInput={(event) => {
              const next = (event.target as HTMLInputElement).value;
              if (normalizeCode(next, numericCode).length === CODE_LENGTH) void verify(next);
            }}
            maxLength={CODE_LENGTH}
            disabled={busy}
            inputMode={numericCode ? 'numeric' : 'text'}
            autoCapitalize="characters"
            aria-label="참여 코드"
            placeholder={numericCode ? '123456' : 'ABC123'}
            className="mt-8 w-full text-center font-bold uppercase outline-none"
            style={{
              height: '56px',
              fontFamily: 'var(--font-mono)',
              fontSize: '32px',
              letterSpacing: '0.25em',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card-workspace)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              opacity: busy ? 0.6 : 1,
            }}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-quaternary)' }}>
            {numericCode ? '숫자만 입력해요' : '숫자와 영문 대문자만 입력해요'}
          </p>

          {errorText ? <JoinError {...errorText} /> : null}

          <button
            type="button"
            onClick={() => void verify(code)}
            disabled={!codeReady || busy}
            className="mt-6 w-full text-sm font-medium transition-colors"
            style={{
              height: '48px',
              borderRadius: 'var(--radius-btn-workspace)',
              background: 'var(--color-btn-primary)',
              color: 'var(--color-surface)',
              opacity: codeReady && !busy ? 1 : 0.45,
            }}
          >
            {busy ? '확인 중...' : '참여하기'}
          </button>
        </>
      ) : (
        <>
          {/* E6 — 수업명+코드 요약 pill 필수. 옆 반 코드를 잘못 적은 학생이 여기서 알아챈다. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {sessionTitle ? (
              <span
                className="rounded-full px-3 py-1 text-[13px]"
                style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-body)' }}
              >
                {sessionTitle}
              </span>
            ) : null}
            <span
              className="rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {code}
            </span>
          </div>

          <h1 className="mt-6 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            이름을 알려주세요
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-body)' }}>
            선생님이 누가 만들었는지 알 수 있어요
          </p>

          {consentNode}

          <input
            value={name}
            {...nameInputHandlers}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitName();
            }}
            disabled={busy}
            aria-label="이름"
            placeholder="이름을 입력하세요"
            className="mx-auto mt-6 w-full max-w-[320px] px-3.5 text-center text-sm outline-none"
            style={{
              height: '48px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-btn-workspace)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              opacity: busy ? 0.6 : 1,
            }}
          />

          {errorText ? <JoinError {...errorText} /> : null}

          <button
            type="button"
            onClick={() => void submitName()}
            disabled={!name.trim() || busy}
            className="mt-6 w-full text-sm font-medium transition-colors"
            style={{
              height: '48px',
              borderRadius: 'var(--radius-btn-workspace)',
              background: 'var(--color-btn-primary)',
              color: 'var(--color-surface)',
              opacity: name.trim() && !busy ? 1 : 0.45,
            }}
          >
            {busy ? '참여 중...' : requiresConsent ? '동의하고 참여하기' : '수업 참여하기'}
          </button>
        </>
      )}

      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full text-sm"
          style={{ height: '44px', color: 'var(--color-text-muted)' }}
        >
          돌아가기
        </button>
      ) : null}
    </div>
  );
}

function JoinError({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="mt-4" role="alert">
      <p className="text-sm" style={{ color: 'var(--color-danger-text)' }}>
        {message}
      </p>
      {hint ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
