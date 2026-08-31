/**
 * 수업 목록 헤더 — BUILDER-UX §4.
 *
 * 확정 사항(2026-08-31 결재):
 * - D2 만들기 버튼 = ＋아이콘(SVG) + 「수업 만들기」. 글자 `+` 금지, 「새」 금지
 * - D9 버튼 44px 이상
 * - D12 빈 화면이어도 이 버튼을 숨기지 않는다 (숨기면 교사가 시작할 손잡이를 잃는다)
 */

export interface SessionsHeaderProps {
  /** 전체 수업 수. */
  total: number;
  /** 진행 중인 수업 수. */
  active: number;
  /**
   * 「수업 만들기」 클릭. 주지 않으면 버튼을 그리지 않는다
   * — 만들기 입구가 별도 페이지인 앱(brand, D7) 전용이며 그 외에는 항상 준다.
   */
  onCreate?: () => void;
  /** 제목. 기본 「내 수업」. */
  title?: string;
}

export function SessionsHeader({ total, active, onCreate, title = '내 수업' }: SessionsHeaderProps) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1
          className="text-2xl font-medium leading-tight tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {total}개 수업 · 진행 중 {active}개
        </p>
      </div>

      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-11 flex-shrink-0 items-center gap-1.5 px-5 text-sm font-medium transition-colors"
          style={{
            background: 'var(--color-btn-primary)',
            color: 'var(--color-surface)',
            borderRadius: 'var(--radius-btn-workspace)',
          }}
        >
          {/* ＋는 글자가 아니라 아이콘이다(D2) — 글꼴에 따라 크기·굵기가 들쭉날쭉하지 않게 */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          수업 만들기
        </button>
      ) : null}
    </div>
  );
}
