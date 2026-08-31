// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionCard } from '../components/sessions/SessionCard';
import { SessionsHeader } from '../components/sessions/SessionsHeader';
import { CreateSessionModal } from '../components/sessions/CreateSessionModal';
import { StatusPill } from '../components/sessions/StatusPill';
import type { SessionSummary } from '../components/sessions/types';

afterEach(() => {
  cleanup();
});

const activeSession: SessionSummary = {
  code: '7KQ4MZ',
  title: '3학년 2반 앱 만들기',
  status: 'active',
  startedLabel: '오늘 14:30 시작',
  stats: [
    { label: '참여 학생', value: 12 },
    { label: '만든 앱', value: 8 },
    { label: '진행 중', value: 4 },
  ],
  studentNames: ['김민수', '이서연', '박지훈', '최유진', '정하늘'],
  totalStudents: 12,
  activity: { studentName: '김민수', action: '완성', targetTitle: '고양이 계산기', timestamp: new Date().toISOString() },
};

const endedSession: SessionSummary = {
  ...activeSession,
  code: 'M2L8KQ',
  title: '2학년 5반 앱 만들기',
  status: 'ended',
  studentNames: [],
  totalStudents: 0,
  activity: null,
};

/**
 * D5 — 삭제는 종료된 카드에만.
 * 🩸 이 결정의 이유는 수업 중 실수 클릭이다. 「onDelete 를 안 넘기면 되지」로는
 * 못 막는다 — 앱이 넘기는 순간 진행 중 카드에 뜨기 때문이다. 부품이 거절해야 한다.
 */
describe('SessionCard — D5 삭제 버튼 위치', () => {
  it('진행 중 카드는 onDelete 를 넘겨도 삭제를 그리지 않는다', () => {
    render(<SessionCard session={activeSession} onOpen={() => {}} onDelete={() => {}} onQR={() => {}} onEnd={() => {}} />);
    expect(screen.queryByText('삭제')).toBeNull();
  });

  it('종료된 카드에만 삭제가 나온다', () => {
    render(<SessionCard session={endedSession} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('삭제')).toBeTruthy();
  });

  it('종료된 카드에는 QR·종료 버튼이 없다 (상태 pill 의 「종료」와 혼동하지 않는다)', () => {
    const { container } = render(
      <SessionCard session={endedSession} onOpen={() => {}} onQR={() => {}} onEnd={() => {}} onDelete={() => {}} />,
    );
    const buttonLabels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttonLabels).not.toContain('QR코드');
    expect(buttonLabels).not.toContain('종료');
    expect(buttonLabels).toContain('삭제');
  });
});

describe('SessionCard — D3·D4·D9 규격', () => {
  it('QR 은 아이콘만이 아니라 「QR코드」 글씨를 갖는다', () => {
    render(<SessionCard session={activeSession} onOpen={() => {}} onQR={() => {}} />);
    expect(screen.getByText('QR코드')).toBeTruthy();
  });

  it('누르는 액션 버튼은 44px 이상이다', () => {
    const { container } = render(
      <SessionCard session={activeSession} onOpen={() => {}} onQR={() => {}} onEnd={() => {}} />,
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(parseInt((button as HTMLElement).style.height, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('통계 숫자는 20px / weight 600', () => {
    const { container } = render(<SessionCard session={activeSession} onOpen={() => {}} />);
    const value = Array.from(container.querySelectorAll('div')).find(
      (el) => (el as HTMLElement).style.fontSize === '20px',
    ) as HTMLElement | undefined;
    expect(value).toBeTruthy();
    expect(value?.style.fontWeight).toBe('600');
  });

  it('통계 영역을 통째로 생략하지 않는다 — 2칸도 그린다', () => {
    render(
      <SessionCard
        session={{ ...activeSession, stats: [{ label: '참여 학생', value: 3 }, { label: '만든 앱', value: 1 }] }}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('참여 학생')).toBeTruthy();
    expect(screen.getByText('만든 앱')).toBeTruthy();
  });

  it('액션 클릭이 카드 열기로 새지 않는다', () => {
    const onOpen = vi.fn();
    const onQR = vi.fn();
    render(<SessionCard session={activeSession} onOpen={onOpen} onQR={onQR} />);
    fireEvent.click(screen.getByText('QR코드'));
    expect(onQR).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('SessionCard — 활동 줄', () => {
  it('학생이 있으면 아바타 4명 + 나머지 +N', () => {
    render(<SessionCard session={activeSession} onOpen={() => {}} />);
    expect(screen.getByText('+8')).toBeTruthy();
  });

  it('활동이 없으면 다음 할 일 힌트를 보여준다', () => {
    render(<SessionCard session={{ ...activeSession, studentNames: [], totalStudents: 0, activity: null }} onOpen={() => {}} />);
    expect(screen.getByText('QR 코드를 학생에게 보여 주면 여기에 활동이 나타나요')).toBeTruthy();
  });
});

/** D11 — 낱말 5종 고정. 「종료됨」·「대기 중」은 이 부품에서 나올 수 없다. */
describe('StatusPill — D11 낱말 5종', () => {
  it.each([
    ['active' as const, '진행 중'],
    ['ended' as const, '종료'],
  ])('수업 %s → %s', (status, label) => {
    render(<StatusPill session={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it.each([
    ['done' as const, '완성'],
    ['inProgress' as const, '진행 중'],
    ['waiting' as const, '대기'],
  ])('학생 %s → %s', (status, label) => {
    render(<StatusPill student={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('폐기된 낱말이 나오지 않는다', () => {
    const { container } = render(
      <>
        <StatusPill session="ended" />
        <StatusPill student="waiting" />
      </>,
    );
    expect(container.textContent).not.toContain('종료됨');
    expect(container.textContent).not.toContain('대기 중');
  });
});

describe('SessionsHeader — D2·D12', () => {
  it('만들기 버튼은 글자 + 가 아니라 아이콘 + 「수업 만들기」', () => {
    const { container } = render(<SessionsHeader total={3} active={2} onCreate={() => {}} />);
    const button = screen.getByText('수업 만들기').closest('button') as HTMLElement;
    expect(button.querySelector('svg')).not.toBeNull();
    // 「새 수업」·「+ 수업 만들기」 같은 변형이 아니어야 한다
    expect(button.textContent?.trim()).toBe('수업 만들기');
    expect(container.textContent).not.toContain('새 수업');
  });

  it('서브텍스트가 「N개 수업 · 진행 중 M개」', () => {
    render(<SessionsHeader total={3} active={2} onCreate={() => {}} />);
    expect(screen.getByText('3개 수업 · 진행 중 2개')).toBeTruthy();
  });

  it('수업이 0개여도 만들기 버튼을 숨기지 않는다 (D12)', () => {
    render(<SessionsHeader total={0} active={0} onCreate={() => {}} />);
    expect(screen.getByText('수업 만들기')).toBeTruthy();
  });
});

describe('CreateSessionModal', () => {
  const base = { open: true, onClose: () => {}, onCreate: () => {} };

  it('제목·설명 문구가 고정돼 있다', () => {
    render(<CreateSessionModal {...base} />);
    expect(screen.getByText('수업 만들기')).toBeTruthy();
    expect(screen.getByText('수업 이름을 입력하면 참여 코드가 자동 발급돼요')).toBeTruthy();
  });

  it('이름이 비면 만들기를 못 누른다', () => {
    const onCreate = vi.fn();
    render(<CreateSessionModal {...base} onCreate={onCreate} />);
    fireEvent.click(screen.getByText('만들기'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 떼고 넘긴다', () => {
    const onCreate = vi.fn();
    render(<CreateSessionModal {...base} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('예: 3학년 2반 앱 만들기'), { target: { value: '  3학년 2반  ' } });
    fireEvent.click(screen.getByText('만들기'));
    expect(onCreate).toHaveBeenCalledWith('3학년 2반');
  });

  it('ESC 로 닫힌다', () => {
    const onClose = vi.fn();
    render(<CreateSessionModal {...base} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('앱 고유 입력칸을 끼워 넣을 수 있다 (studio 수업 종류 등)', () => {
    render(
      <CreateSessionModal {...base}>
        <label>수업 종류</label>
      </CreateSessionModal>,
    );
    expect(screen.getByText('수업 종류')).toBeTruthy();
  });
});
