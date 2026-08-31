import { formatRelativeTime } from '../../lib/relative-time';
import { StatusPill } from './StatusPill';
import type { SessionSummary } from './types';

/**
 * 수업 카드 — BUILDER-UX §4 · DESIGN-POLICY §10-A.
 * 단순 바로가기가 아니라 «수업 현황 미니 대시보드»다 — 교사가 카드를 열지 않고도 상태를 안다.
 *
 * 확정 사항(2026-08-31 결재):
 * - D3 QR = 검정 채움 + 아이콘 + 「QR코드」 글씨. 아이콘 전용 금지
 * - D4 통계 숫자 20px / 600, 라벨 11.5px
 * - D5 삭제는 종료된 카드에만 — 수업 중 실수로 눌리는 파괴 동작을 화면에서 없앤다
 * - D9 액션 버튼 44px
 * - D11 상태 낱말 5종 고정(StatusPill 이 강제)
 */

const AVATAR_PALETTE = [1, 2, 3, 4] as const;

/** 아바타 색은 이름으로 고정한다 — 같은 학생이 매번 같은 색이라야 교사가 알아본다. */
function avatarIndex(name: string): (typeof AVATAR_PALETTE)[number] {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function Avatar({ name, overlap }: { name: string; overlap: boolean }) {
  const idx = avatarIndex(name);
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10.5px] font-medium${overlap ? ' -ml-2' : ''}`}
      style={{
        background: `linear-gradient(135deg, var(--color-avatar-${idx}-from), var(--color-avatar-${idx}-to))`,
        color: `var(--color-avatar-${idx}-fg)`,
        borderColor: 'var(--color-surface)',
      }}
      title={name}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function QRIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 12 L21 12 M15 15 L18 15 L18 21 L15 21 L15 18" />
    </svg>
  );
}

export interface SessionCardProps {
  session: SessionSummary;
  /** 카드 전체 클릭 = 수업 상세로. */
  onOpen: () => void;
  /** 진행 중 카드에만 그린다. */
  onQR?: () => void;
  /** 진행 중 카드에만 그린다. */
  onEnd?: () => void;
  /** 🚨 종료된 카드에만 그린다(D5). 진행 중 카드에는 넘겨도 나오지 않는다. */
  onDelete?: () => void;
  /** 종료 처리 중 — 버튼을 잠근다. */
  ending?: boolean;
  /** 활동이 아직 없을 때 보여줄 한 줄. 기본은 QR 안내. */
  emptyHint?: string;
}

export function SessionCard({
  session,
  onOpen,
  onQR,
  onEnd,
  onDelete,
  ending = false,
  emptyHint = 'QR 코드를 학생에게 보여 주면 여기에 활동이 나타나요',
}: SessionCardProps) {
  const active = session.status === 'active';
  const names = session.studentNames ?? [];
  const shown = names.slice(0, 4);
  const overflow = (session.totalStudents ?? names.length) - shown.length;

  const actionButtonStyle = {
    height: '44px',
    padding: '0 14px',
    borderRadius: 'var(--radius-btn-workspace)',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    fontSize: '13px',
  } as const;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col gap-3.5 p-5 transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card-workspace)',
        background: 'var(--color-surface)',
        opacity: active ? 1 : 0.55,
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-[50px] w-[82px] flex-shrink-0 items-center justify-center text-[15px] font-bold tracking-[0.06em]"
          style={{
            background: 'var(--color-surface-alt)',
            borderRadius: 'var(--radius-card-workspace)',
            fontFamily: 'var(--font-mono)',
            color: active ? 'var(--color-text-primary)' : 'var(--color-text-quaternary)',
          }}
        >
          {session.code}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className="truncate text-base font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {session.title}
            </h3>
            <StatusPill session={session.status} />
          </div>
          {session.startedLabel ? (
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
              {session.startedLabel}
            </p>
          ) : null}
        </div>

        {/* 액션 순서 = QR → 종료 → 삭제(종료 카드에만). §10-A */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {active && onQR ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQR();
              }}
              className="inline-flex items-center gap-1.5 font-semibold transition-colors"
              style={{
                height: '44px',
                padding: '0 14px',
                minWidth: '92px',
                borderRadius: '13px',
                background: 'var(--color-btn-primary)',
                color: 'var(--color-surface)',
                fontSize: '13px',
              }}
            >
              <QRIcon />
              QR코드
            </button>
          ) : null}

          {active && onEnd ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEnd();
              }}
              disabled={ending}
              className="transition-colors"
              style={{
                ...actionButtonStyle,
                color: 'var(--color-text-muted)',
                opacity: ending ? 0.45 : 1,
              }}
            >
              {ending ? '종료 중...' : '종료'}
            </button>
          ) : null}

          {/* 🚨 D5 — 진행 중 카드에는 삭제를 두지 않는다. onDelete 를 넘겨도 나오지 않는다. */}
          {!active && onDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="transition-colors"
              style={{ ...actionButtonStyle, color: 'var(--color-text-quaternary)' }}
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>

      {/* 통계 3칸 — 칸 이름은 앱 자유, 영역 통째 생략 금지(2칸까지 축소 가능). D4 */}
      <div
        className="grid py-3"
        style={{
          gridTemplateColumns: `repeat(${Math.max(session.stats.length, 1)}, minmax(0, 1fr))`,
          borderTop: '1px solid var(--color-surface-hover)',
          borderBottom: '1px solid var(--color-surface-hover)',
        }}
      >
        {session.stats.map((stat, i) => (
          <div key={stat.label} style={i > 0 ? { borderLeft: '1px solid var(--color-surface-hover)' } : undefined}>
            <div
              className="text-center"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              {stat.value}
            </div>
            <div
              className="text-center font-medium"
              style={{ fontSize: '11.5px', color: 'var(--color-text-quaternary)' }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {shown.length > 0 ? (
        <div className="flex items-center gap-3 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          <div className="flex flex-shrink-0 items-center">
            {shown.map((name, i) => (
              <Avatar key={`${name}-${i}`} name={name} overlap={i > 0} />
            ))}
            {overflow > 0 ? (
              <span
                className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10.5px] font-medium"
                style={{
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text-muted)',
                  borderColor: 'var(--color-surface)',
                }}
              >
                +{overflow}
              </span>
            ) : null}
          </div>

          {session.activity ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">
                <strong className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {session.activity.studentName}
                </strong>
                {session.activity.targetTitle
                  ? `님이 "${session.activity.targetTitle}" ${session.activity.action}`
                  : `님이 ${session.activity.action}`}
              </span>
              <span className="flex-shrink-0 text-xs" style={{ color: 'var(--color-text-quaternary)' }}>
                {formatRelativeTime(session.activity.timestamp, { mode: 'compact' })}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 text-[12.5px]"
          style={{ color: 'var(--color-text-quaternary)' }}
        >
          {active ? (
            <>
              <QRIcon size={14} />
              <span>{emptyHint}</span>
            </>
          ) : (
            <span>종료된 수업이에요</span>
          )}
        </div>
      )}
    </div>
  );
}
