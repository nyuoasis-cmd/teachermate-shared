import { useRef } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';

type InputLike = HTMLInputElement | HTMLTextAreaElement;

export interface ImeSafeInputHandlers {
  onChange: (event: ChangeEvent<InputLike>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (event: CompositionEvent<InputLike>) => void;
}

/**
 * 순수 함수(테스트용) — 조합 중이면 변환을 적용하지 않고 raw, 아니면 transform(raw).
 * 조합 중 변환 미적용이 IME(한글 등 CJK) 글자 유실 방지의 핵심이다.
 */
export function imeEmitValue(
  raw: string,
  composing: boolean,
  transform?: (value: string) => string,
): string {
  return composing || !transform ? raw : transform(raw);
}

/**
 * IME 조합 안전 입력 헬퍼 — 타블렛/모바일 온스크린 키보드 글자 유실 방지(DESIGN-POLICY §9.H-3.1).
 *
 * 배경(2026-06-17 data-class 타블렛 PC 치명 버그): controlled input의 `onChange`에서 value를
 * 변환(toUpperCase/replace 등)해 되먹이면, 조합 중인 문자열이 IME 내부 조합 버퍼와 불일치해
 * 데스크톱에선 잘 안 드러나지만 타블렛/모바일 온스크린 한글 키보드에서 조합 중 글자가 통째로
 * 사라진다(기기 문제로 오인 → 대안 없음).
 *
 * 규칙:
 *  - 조합 중(compositionStart~End)에는 변환하지 않고 raw 값만 반영(value 가 input 실제값과 동일 →
 *    React 가 value 를 재설정하지 않아 조합이 보존됨).
 *  - 조합 종료(compositionEnd)에 변환을 1회 적용.
 *  - Chrome 등은 compositionEnd 직후 같은 raw 로 onChange 를 또 보낸다 → 1회 무시(중복 side-effect 방지).
 *
 * 사용:
 *   const code = useImeSafeInput(setCode, (v) => v.toUpperCase());
 *   <input value={code} {...code의 spread 아님 — 아래처럼} />
 *   const codeProps = useImeSafeInput(setCode, (v) => v.toUpperCase());
 *   <input value={value} {...codeProps} />
 *
 * ⚠️ 숫자 전용 필드는 이 훅만으로 부족 — `inputMode="numeric"`로 IME 자체를 피하고 sanitize 는
 *    compositionEnd/onBlur/제출 시점으로 제한할 것(DESIGN-POLICY §9.H-3.1).
 */
export function useImeSafeInput(
  onValue: (value: string) => void,
  transform?: (value: string) => string,
): ImeSafeInputHandlers {
  const composingRef = useRef(false);
  const skipNextRawRef = useRef<string | null>(null);
  const emit = (raw: string) => {
    onValue(imeEmitValue(raw, composingRef.current, transform));
  };
  return {
    onChange: (event: ChangeEvent<InputLike>) => {
      const raw = event.target.value;
      if (skipNextRawRef.current !== null) {
        const skip = skipNextRawRef.current;
        skipNextRawRef.current = null;
        if (skip === raw) return;
      }
      emit(raw);
    },
    onCompositionStart: () => {
      composingRef.current = true;
      skipNextRawRef.current = null;
    },
    onCompositionEnd: (event: CompositionEvent<InputLike>) => {
      composingRef.current = false;
      const raw = (event.target as InputLike).value;
      skipNextRawRef.current = raw;
      emit(raw);
    },
  };
}
