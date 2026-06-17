// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { imeEmitValue, useImeSafeInput } from '../hooks/useImeSafeInput';

afterEach(() => {
  cleanup();
});

const upper = (value: string) => value.toUpperCase();

function CodeInput({ onEmit }: { onEmit?: (v: string) => void }) {
  const [value, setValue] = useState('');
  const props = useImeSafeInput((next) => {
    setValue(next);
    onEmit?.(next);
  }, upper);
  return <input data-testid="code" value={value} {...props} />;
}

describe('imeEmitValue', () => {
  it('조합 중에는 변환을 적용하지 않는다', () => {
    expect(imeEmitValue('ㄱ', true, upper)).toBe('ㄱ');
    expect(imeEmitValue('a8c3', true, upper)).toBe('a8c3');
  });
  it('조합이 아닐 때는 변환을 적용한다', () => {
    expect(imeEmitValue('a8c3', false, upper)).toBe('A8C3');
  });
  it('transform 이 없으면 항상 raw', () => {
    expect(imeEmitValue('홍길동', true, undefined)).toBe('홍길동');
    expect(imeEmitValue('홍길동', false, undefined)).toBe('홍길동');
  });
});

describe('useImeSafeInput (실 이벤트 시퀀스)', () => {
  it('조합 중 onChange 는 변환하지 않고, compositionEnd 에 1회 변환한다', () => {
    const emits: string[] = [];
    const { getByTestId } = render(<CodeInput onEmit={(v) => emits.push(v)} />);
    const input = getByTestId('code') as HTMLInputElement;

    fireEvent.compositionStart(input);
    // 조합 중: 변환 보류(영문이 들어와도 toUpperCase 안 함)
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(emits.at(-1)).toBe('ab');

    // 조합 종료: 최종값에 변환 1회
    fireEvent.compositionEnd(input, { target: { value: 'ab' } });
    expect(emits.at(-1)).toBe('AB');
  });

  it('Chrome 시퀀스: compositionEnd 직후 동일 raw onChange 는 무시(중복 방출 없음)', () => {
    const emits: string[] = [];
    const { getByTestId } = render(<CodeInput onEmit={(v) => emits.push(v)} />);
    const input = getByTestId('code') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.compositionEnd(input, { target: { value: '가' } });
    // Chrome 후속 onChange (동일 raw)
    fireEvent.change(input, { target: { value: '가' } });

    // '가'(조합중) → '가'(end) → 후속 onChange 무시
    expect(emits).toEqual(['가', '가']);
  });

  it('조합 없는 일반 입력은 즉시 변환한다', () => {
    const emits: string[] = [];
    const { getByTestId } = render(<CodeInput onEmit={(v) => emits.push(v)} />);
    const input = getByTestId('code') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a8c3k1' } });
    expect(emits.at(-1)).toBe('A8C3K1');
  });
});
