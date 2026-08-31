// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinFlow } from '../components/join/JoinFlow';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ok = (sessionTitle?: string) => Promise.resolve({ ok: true as const, sessionTitle });

function setup(overrides: Partial<React.ComponentProps<typeof JoinFlow>> = {}) {
  const props = {
    onVerifyCode: vi.fn(() => ok('3학년 2반 앱 만들기')),
    onSubmitName: vi.fn(() => ok()),
    onDone: vi.fn(),
    ...overrides,
  };
  render(<JoinFlow {...props} />);
  return props;
}

const typeCode = (value: string) => {
  const input = screen.getByLabelText('참여 코드');
  fireEvent.change(input, { target: { value } });
  fireEvent.input(input, { target: { value } });
  return input;
};

describe('E1 — 3단계 흐름', () => {
  it('코드 → 이름 → 완료 순서로 간다', async () => {
    setup();
    expect(screen.getByText('수업 참여하기')).toBeTruthy();

    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '민수' } });
    fireEvent.click(screen.getByText('수업 참여하기'));

    // 완료 화면은 생략할 수 없다 — 예외 없음(E1)
    await screen.findByText('민수님, 시작해볼까요!');
    expect(screen.getByText('잠시 후 이동해요')).toBeTruthy();
  });

  it('완료 화면을 1.2초 보여준 뒤 넘긴다', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    setup({ onDone });

    typeCode('7KQ4MZ');
    // 가짜 타이머 아래서도 프라미스는 마이크로태스크라 act 로 흘려보내면 된다
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '민수' } });
    fireEvent.click(screen.getByText('수업 참여하기'));
    await act(async () => {});
    expect(screen.getByText('민수님, 시작해볼까요!')).toBeTruthy();

    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1199);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledWith('민수', '7KQ4MZ');
  });

  it('QR 진입이면 코드 단계에서 멈추지 않는다 (프리필만 하고 세우면 위반)', async () => {
    const onVerifyCode = vi.fn(() => ok('3학년 2반 앱 만들기'));
    render(
      <JoinFlow initialCode="7kq4mz" onVerifyCode={onVerifyCode} onSubmitName={() => ok()} onDone={() => {}} />,
    );
    await screen.findByText('이름을 알려주세요');
    // 소문자로 들어와도 정규화해서 검증한다
    expect(onVerifyCode).toHaveBeenCalledWith('7KQ4MZ');
  });
});

describe('E6 — 이름 단계 수업 요약', () => {
  it('수업명과 코드를 함께 보여준다 (옆 반 코드를 여기서 알아챈다)', async () => {
    setup();
    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');
    expect(screen.getByText('3학년 2반 앱 만들기')).toBeTruthy();
    expect(screen.getByText('7KQ4MZ')).toBeTruthy();
  });
});

/**
 * E8 — 오류 3종 문구 고정.
 * 🩸 이 시험들이 있는 이유: sangkwon 은 서버 409(종료)를 「연결이 불안정해요」로,
 * data-class 는 session_ended 를 「잠시 뒤 다시 시도해보세요」로 말했다.
 * 원인과 무관한 문구는 학생을 무한 재시도로 몬다.
 */
describe('E8 — 오류 문구', () => {
  it('종료된 수업은 종료라고 말한다 — 연결 오류로 말하지 않는다', async () => {
    setup({ onVerifyCode: vi.fn(() => Promise.resolve({ ok: false as const, reason: 'ended' as const })) });
    typeCode('7KQ4MZ');
    await screen.findByText('이 수업은 종료되어 참여할 수 없어요');
    expect(screen.getByText('선생님께 새 코드를 받아 주세요')).toBeTruthy();
    expect(screen.queryByText(/연결이 불안정/)).toBeNull();
    expect(screen.queryByText(/다시 시도해보세요/)).toBeNull();
  });

  it('틀린 코드와 종료를 같은 문구로 뭉치지 않는다', async () => {
    setup({ onVerifyCode: vi.fn(() => Promise.resolve({ ok: false as const, reason: 'notFound' as const })) });
    typeCode('AAAAAA');
    await screen.findByText('수업을 찾을 수 없어요. 코드를 다시 확인해 주세요');
    expect(screen.queryByText(/종료되어/)).toBeNull();
  });

  it('통신이 끊기면(throw) 연결 문구가 나온다', async () => {
    setup({ onVerifyCode: vi.fn(() => Promise.reject(new Error('offline'))) });
    typeCode('7KQ4MZ');
    await screen.findByText('연결이 불안정해요. 다시 시도해 주세요');
  });

  it('중복 이름 문구는 1종 고정 (E7)', async () => {
    setup({ onSubmitName: vi.fn(() => Promise.resolve({ ok: false as const, reason: 'nameTaken' as const })) });
    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '민수' } });
    fireEvent.click(screen.getByText('수업 참여하기'));
    await screen.findByText('이 이름은 이미 사용 중이에요. 이름 뒤에 번호를 붙여 주세요');
  });

  it('실패해도 다시 누를 손잡이가 남는다 (E5 — 버튼 없이 자동검증만이면 학생이 멈춘다)', async () => {
    const onVerifyCode = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'notFound' })
      .mockResolvedValueOnce({ ok: true, sessionTitle: '3학년 2반' });
    setup({ onVerifyCode });

    typeCode('AAAAAA');
    await screen.findByText('수업을 찾을 수 없어요. 코드를 다시 확인해 주세요');

    fireEvent.click(screen.getByText('참여하기'));
    await screen.findByText('이름을 알려주세요');
    expect(onVerifyCode).toHaveBeenCalledTimes(2);
  });
});

describe('E5 — 자동 검증', () => {
  it('6자를 채우면 버튼을 누르지 않아도 검증한다', async () => {
    const onVerifyCode = vi.fn(() => ok('3학년 2반'));
    setup({ onVerifyCode });
    typeCode('7KQ4MZ');
    await waitFor(() => expect(onVerifyCode).toHaveBeenCalledTimes(1));
  });

  it('5자까지는 검증하지 않는다', async () => {
    const onVerifyCode = vi.fn(() => ok());
    setup({ onVerifyCode });
    typeCode('7KQ4M');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onVerifyCode).not.toHaveBeenCalled();
  });

  it('자동 검증과 버튼이 같은 코드로 두 번 날아가지 않는다', async () => {
    const onVerifyCode = vi.fn(() => ok('3학년 2반'));
    setup({ onVerifyCode });
    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');
    expect(onVerifyCode).toHaveBeenCalledTimes(1);
  });
});

/**
 * E11 — 정규화 시점.
 * 🚨 onChange 에서 대문자·영숫자 변환을 되먹이면 한글 IME 조합이 깨진다(§9.H-3.1).
 * onChange 가 해도 되는 것은 길이 자르기까지다.
 */
describe('E11 — 정규화 시점', () => {
  it('입력 중에는 값을 바꾸지 않는다', () => {
    setup();
    const input = typeCode('a1') as HTMLInputElement;
    expect(input.value).toBe('a1');
  });

  it('조합 중에는 변환하지 않는다 (한글이 사라지지 않게)', () => {
    setup();
    const input = screen.getByLabelText('참여 코드') as HTMLInputElement;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㅁㄴ' } });
    expect(input.value).toBe('ㅁㄴ');
  });

  it('blur 에서 대문자·영숫자로 정리한다', () => {
    setup();
    const input = screen.getByLabelText('참여 코드') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a1-b2' } });
    // React 17+ 는 onBlur 를 focusout 으로 받는다. 실제 브라우저는 blur 와 함께 쏘므로
    // 제품 동작은 같고, jsdom 에서만 이 이벤트를 써야 한다.
    fireEvent.focusOut(input);
    expect(input.value).toBe('A1B2');
  });

  it('조합이 끝나면 정리한다', () => {
    setup();
    const input = screen.getByLabelText('참여 코드') as HTMLInputElement;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.compositionEnd(input, { target: { value: 'ab' } });
    expect(input.value).toBe('AB');
  });
});

describe('E3·E4 — 숫자 코드 앱', () => {
  it('영숫자 앱의 placeholder 는 ABC123', () => {
    setup();
    expect(screen.getByPlaceholderText('ABC123')).toBeTruthy();
  });

  it('숫자 코드 앱은 123456 + 숫자 키패드', () => {
    render(<JoinFlow numericCode onVerifyCode={() => ok()} onSubmitName={() => ok()} onDone={() => {}} />);
    const input = screen.getByPlaceholderText('123456');
    expect(input.getAttribute('inputMode')).toBe('numeric');
  });

  it('숫자 코드 앱은 영문을 걸러낸다', () => {
    render(<JoinFlow numericCode onVerifyCode={() => ok()} onSubmitName={() => ok()} onDone={() => {}} />);
    const input = screen.getByPlaceholderText('123456') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a34' } });
    fireEvent.focusOut(input);
    expect(input.value).toBe('1234');
  });
});

describe('E10 — 버튼 낱말', () => {
  it('기본은 「수업 참여하기」', async () => {
    setup();
    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');
    expect(screen.getByText('수업 참여하기')).toBeTruthy();
    expect(screen.queryByText('시작하기')).toBeNull();
    expect(screen.queryByText('참여 시작')).toBeNull();
  });

  it('동의가 필요한 앱만 「동의하고 참여하기」', async () => {
    render(
      <JoinFlow requiresConsent onVerifyCode={() => ok('3학년 2반')} onSubmitName={() => ok()} onDone={() => {}} />,
    );
    typeCode('7KQ4MZ');
    await screen.findByText('이름을 알려주세요');
    expect(screen.getByText('동의하고 참여하기')).toBeTruthy();
  });

  it('이름칸 라벨은 「이름」 — 「닉네임」 폐기', () => {
    setup();
    expect(screen.queryByLabelText('닉네임')).toBeNull();
  });
});
