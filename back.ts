// 뒤로가기·나가기 부품만 모은 입구 — `import { useExitGuard } from '@teachermate/shared/back'`.
// 🔑 패키지 입구(index)는 lucide·pdf-lib·supabase 까지 끌어온다. 그 의존이 없는 앱(plan-v3 등)도
//    이 부품만은 쓸 수 있어야 §9.H-18 v2.4 「가드는 공용 부품 하나」 가 성립한다. react 외 의존 0.
export { useExitGuard, isFirstInAppEntry } from './hooks/useExitGuard.js';
export type { UseExitGuardOptions, UseExitGuardReturn, ExitGuardCallback } from './hooks/useExitGuard.js';
export { useBackClosable, isBackConsumed } from './hooks/useBackClosable.js';
