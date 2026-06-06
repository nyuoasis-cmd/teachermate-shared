# Preflight 검증 리포트 — teachermate-shared useExitGuard (슬라이스 0)

설계: `docs/SDD-useexitguard-v1.md` + `PLAN-useexitguard.md` (codex Plan R13 + SDD R8 APPROVED).
검증 방식: 추측 금지 — 임시 파일로 **실 컴파일·실 jsdom 실행** 후 삭제. (영역 1 외부 API / 영역 3 DB = 본 슬라이스 N/A.)

## 1. API 실현성 (History API)
- ✅ **popstate 발화·청취** — jsdom에서 `dispatchEvent(new PopStateEvent('popstate'))` 핸들러 1회 호출 확인.
- ✅ **history.back() 비동기성** — `history.back()` 직후 동기 시점에 popstate **미발화**(setTimeout 후 처리). → 설계의 one-shot popstate 리스너 + timeout fallback + exactly-once latch(R4~R8)가 **반드시 필요함을 실증**. 동기 소비 가정이었다면 버그.
- ✅ **history.state spread merge** — `pushState({ ...history.state, __tmExitGuard }, '', href)`가 기존 router-owned 필드(routerKey/idx) **보존** 확인 (SC-T12 실현).
- 외부 HTTP/CORS/rate limit = 해당 없음(네트워크 미사용).

## 2. 패키지 호환성
- ✅ **react-router-dom optional peer 무관** — useExitGuard는 `useBlocker` 미사용, popstate(History API)만. react-router import 0 → optional peer 계약 위반 없음, Data Router 미사용 앱에서도 동작.
- ✅ **react 18·19 peer** — 훅은 useState/useRef/useEffect/useCallback만 사용(표준). 신규 런타임 의존 0.
- ✅ **빌드(tsc) 호환** — DEV 감지 typed 캐스트 `(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true` 가 실 tsconfig(`types:["react","react-dom"]`, module ESNext)에서 **`tsc --noEmit` EXIT=0** 컴파일. 리터럴 `import.meta.env.DEV`는 금지(SC-9b) — typecheck 깨짐.
- ✅ **번들/배포** — `prepare`(tsc)가 consumer install 시 dist 빌드, dist gitignore. 신규 파일 2개(hook/modal) include 경로(`hooks/**`,`components/**`) 안.
- ✅ 라이선스 영향 없음(신규 외부 dep 0).

## 3. DB/타입 정합성
- ✅ **DB 변경 없음**(N/A).
- ✅ **타입 export 충돌 없음** — `UseExitGuardOptions`/`UseExitGuardReturn`/`useExitGuard`/`ExitGuardModal`는 기존 36 export와 이름 충돌 없음(index.ts grep 신규명).
- ✅ **기존 인터페이스 호환** — useBeforeUnload/DirtyGuard/BackToSessions/ConfirmModal 시그니처 불변, useExitGuard는 신규 추가.

## 4. UX 흐름 (SDD §6)
- ✅ **분기 커버** — when=true 뒤로가기→모달(나가기/취소), when=false→잔류, 내부이탈→releaseAndNavigate, 탭닫기→beforeunload. SDD §6.5 SC-T1~T24가 분기별 AC.
- ✅ **이탈+복귀** — confirmExit/releaseAndNavigate 후 stale·재진입·재오픈 처리 명세(SC-T9/T11/T17/T23).
- ✅ **교사/학생 분기** — BackToSessions audience 재사용(ExitGuardModal 카피). 가드 자체는 audience 무관(브라우저 뒤로가기).
- ⚠️ **beforeunload 동기 disarm** — jsdom에서 ref 이벤트시점 게이팅 동작 확인(armed→preventDefault, released→미차단). 실 브라우저 location.assign 경합은 구현 후 실앱 QA 권고(슬라이스 1에서 앱별 검증).

---
## 종합 판정
- ✅ PASS: 13
- ⚠️ WARN: 1 (beforeunload 실브라우저 동기 disarm — 구현 후 슬라이스 1 앱 QA에서 재확인, 비치명)
- ❌ FAIL: 0

**VERDICT = PASS.** 슬라이스 0 구현 착수 가능. 핵심 기술 가정(비동기 back·state merge·DEV 캐스트 컴파일·optional peer 무관)이 전부 실 실행으로 검증됨.

### WARN 권고
- beforeunload 동기 disarm: jsdom 단위 테스트(SC-T8)로 1차 보장. 실 브라우저 `location.assign` 즉시 unload 경합은 슬라이스 1 각 앱 적용 시 real-flow QA에서 확인. 비치명(구현 설계는 ref 게이팅으로 이미 대응).

### 실측 증거
- typecheck EXIT=0 (DEV 캐스트 + spread merge 포함)
- jsdom 4/4 pass: pushState merge 보존 / popstate 발화 / history.back 비동기 / beforeunload ref 게이팅
- baseline: `npm test` 87 pass, `npm run typecheck` EXIT=0
