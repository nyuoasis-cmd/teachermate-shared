import type { SessionStatus, StudentStatus } from './types';

/**
 * 상태 pill — 낱말·색 5종 고정 (D11, 2026-08-31 결재).
 *
 * 🚨 앱이 낱말도 색도 바꾸지 않는다. 교사가 여러 앱을 오가며 수업하는데
 * 「초록 = 진행 중」이 앱마다 다르면 상태를 매번 다시 배워야 한다(DESIGN-POLICY §9.B).
 *
 * 폐기된 표기: 「종료됨」(sangkwon) · 「대기 중」(kospi).
 */

type Tone = { bg: string; fg: string; dot: string; pulse: boolean };

const SESSION_LABEL: Record<SessionStatus, string> = {
  active: '진행 중',
  ended: '종료',
};

const STUDENT_LABEL: Record<StudentStatus, string> = {
  done: '완성',
  inProgress: '진행 중',
  waiting: '대기',
};

const SESSION_TONE: Record<SessionStatus, Tone> = {
  active: {
    bg: 'var(--color-success-bg)',
    fg: 'var(--color-success-text)',
    dot: 'var(--color-success-text)',
    pulse: true,
  },
  ended: {
    bg: 'var(--color-surface-hover)',
    fg: 'var(--color-text-muted)',
    dot: 'var(--color-text-quaternary)',
    pulse: false,
  },
};

const STUDENT_TONE: Record<StudentStatus, Tone> = {
  done: {
    bg: 'var(--color-success-bg)',
    fg: 'var(--color-success-text)',
    dot: 'var(--color-success-text)',
    pulse: false,
  },
  // 학생 「진행 중」은 파랑 — 수업 「진행 중」(초록)과 구별한다.
  inProgress: {
    bg: 'var(--color-progress-bg)',
    fg: 'var(--color-progress-text)',
    dot: 'var(--color-progress-text)',
    pulse: false,
  },
  waiting: {
    bg: 'var(--color-surface-hover)',
    fg: 'var(--color-text-muted)',
    dot: 'var(--color-text-quaternary)',
    pulse: false,
  },
};

export interface StatusPillProps {
  /** 수업 상태 — session 과 student 중 하나만 준다. */
  session?: SessionStatus;
  /** 학생 상태. */
  student?: StudentStatus;
}

export function StatusPill({ session, student }: StatusPillProps) {
  const label = session ? SESSION_LABEL[session] : student ? STUDENT_LABEL[student] : null;
  const tone = session ? SESSION_TONE[session] : student ? STUDENT_TONE[student] : null;

  if (!label || !tone) return null;

  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full${tone.pulse ? ' animate-pulse' : ''}`}
        style={{ background: tone.dot }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
