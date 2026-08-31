/**
 * 한결 v2 수업 대시보드 공용 부품 — 공통 타입.
 *
 * 정본: BUILDER-UX-POLICY §4 · DESIGN-POLICY §10-A
 * 확정 근거: shared/mockups/hangyeol-v2-final-2026-08-31.html §2 (D1~D12, 2026-08-31 jery 결재)
 */

/** 수업 상태 — 낱말 2종 고정(D11). 「종료됨」 금지. */
export type SessionStatus = 'active' | 'ended';

/** 학생 상태 — 낱말 3종 고정(D11). 「대기 중」 금지. */
export type StudentStatus = 'done' | 'inProgress' | 'waiting';

/** 통계 한 칸. 칸 이름은 앱 자유, 영역 통째 생략은 금지(2칸까지 축소 가능). */
export interface SessionStat {
  label: string;
  value: number;
}

/** 최근 활동 1건. 없으면 「다음 할 일」 힌트가 대신 나온다. */
export interface SessionActivity {
  studentName: string;
  /** 「완성」 「제출」 등 — 앱이 정한다. */
  action: string;
  /** 있으면 `{이름}님이 "{제목}" {동작}` 으로 조립된다. */
  targetTitle?: string;
  timestamp: string;
}

export interface SessionSummary {
  /** 참여 코드. 카드 왼쪽 첫 칸 타일에 그린다. */
  code: string;
  title: string;
  status: SessionStatus;
  /** 「오늘 14:30 시작」 등 이미 사람이 읽을 수 있게 만든 문자열. */
  startedLabel?: string;
  /** 최대 3칸. 2칸까지 축소 허용, 0칸(생략) 금지. */
  stats: SessionStat[];
  /** 아바타로 그릴 이름들. 앞 4명만 쓰고 나머지는 +N. */
  studentNames?: string[];
  /** studentNames 보다 실제 참여자가 많을 때의 총원(+N 계산용). */
  totalStudents?: number;
  activity?: SessionActivity | null;
}
