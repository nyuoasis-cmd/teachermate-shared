# SDD — teachermate-shared `useExitGuard` 공유 훅 v1 (뒤로가기 가드 에픽 슬라이스 0)

> 본 SDD는 승인된 `PLAN-useexitguard.md`(codex R13 approve)를 구현 명세로 옮긴 것. 깊은 동작 계약은 Plan의 **ADR-1 부속 sentinel 생명주기 계약**이 단일 진실 소스이며, 본 SDD는 그것을 grep 가능한 Sprint Contract와 GWT AC로 박는다.

## §0 메타
| 항목 | 값 |
|------|-----|
| branch | `feat/useexitguard` |
| base | `main` |
| repo | nyuoasis-cmd/teachermate-shared (`@teachermate/shared`) |
| 산출 버전 | 0.13.0 → **0.14.0** |
| 빌드/배포 | dist는 gitignore. consumer `npm install` 시 `prepare`(tsc)가 빌드. 슬라이스 0은 dist 커밋 안 함 |
| generator model override | **codex** (또는 Phase 4 결정에 따라 master 직접) |
| eval model | 단위 테스트(vitest) 중심 — 시각 산출물 없음 |
| 앱 코드 변경 | **0** (Out of Scope) |

## §1 목적
세션·학생 화면에서 브라우저/하드웨어 뒤로가기로 앱 밖 이탈을 막는 표준 훅을 공유 패키지에 신설(DESIGN-POLICY §9.H-18 단일 소스). 라우터 무관(popstate), 기존 DirtyGuard/ConfirmModal/BackToSessions 재사용·불변.

## §2 현재 상태 (실측)
- `@teachermate/shared` v0.13.0, `index.ts` 36 export. `react-router-dom`은 **optional** peer(`package.json:25-29`).
- 기존(불변): `hooks/useBeforeUnload.ts`(beforeunload만 — **새 훅은 이를 쓰지 않고 자체 beforeunload 핸들러를 등록**, Plan R9), `components/useDirtyGuard.tsx`, `components/BackToSessions.tsx`, `components/ConfirmModal.tsx`(ExitGuardModal이 재사용).
- 테스트: `tests/*.test.tsx` vitest+jsdom, `tests/useBeforeUnload.test.tsx` 패턴 보유. `npm test` = `vitest run --environment jsdom`.
- 레퍼런스 패턴: block-design `src/pages/DesignPage.tsx:48-62`(pushState+popstate), ar-storybook `src/pages/Create.tsx:103-109`(useBlocker — 채택 안 함).

## §3 변경 명세 + Sprint Contract (측정 가능 grep)
### STEP 1 — `hooks/useExitGuard.ts` 신규
구현은 Plan ADR-1 부속(소유권 원칙·항목 1~9·충돌경계·terminal disarm·fallback) 전부 충족.
- **SC-1** `test -f hooks/useExitGuard.ts` = 존재.
- **SC-2** `grep -c "export function useExitGuard" hooks/useExitGuard.ts` ≥ 1.
- **SC-3** `grep -c "__tmExitGuard" hooks/useExitGuard.ts` ≥ 1 (sentinel 마커).
- **SC-4** `grep -c "\.\.\.\(window\.\)\?history\.state" hooks/useExitGuard.ts` ≥ 1 (router state spread merge 보존 — codex R9).
- **SC-5** `grep -c "popstate" hooks/useExitGuard.ts` ≥ 1.
- **SC-6** `grep -c "ownsSentinelRef" hooks/useExitGuard.ts` ≥ 1 (단일 소유자 게이팅 — codex R11).
- **SC-7** `grep -c "releasedRef" hooks/useExitGuard.ts` ≥ 1 (동기 disarm ref — codex R7/R9).
- **SC-8** `grep -c "releaseAndNavigate" hooks/useExitGuard.ts` ≥ 1.
- **SC-9** 라우트당1개 DEV 경고(codex R12)는 **빌드 호환 DEV 감지**로 구현(codex SDD R3 [high]). 이 패키지는 순수 `tsc` 빌드 + tsconfig `types:["react","react-dom"]`(vite/client 없음)이라 리터럴 `import.meta.env.DEV`는 `ImportMeta.env` 미정의로 typecheck 실패. **권장 형태**(ambient vite 타입 불요, tsc 통과): `const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true`. **검증 = grep 리터럴 강제 폐기 →** SC-19(`npm run typecheck` EXIT=0)와 **동시 통과** + 동작은 **SC-T13 테스트**(dev/test 모드에서 중복 활성 가드 시 `console.error` 호출)로 실증.
- **SC-9b (회귀 금지 grep-negative, codex SDD R4)** `grep -c "import\.meta\.env\.DEV" hooks/useExitGuard.ts components/ExitGuardModal.tsx` = **0** (빌드 깨는 리터럴 형태 금지 — typed 캐스트만 허용). Plan도 동일 typed 형태로 정정(Plan↔SDD 일치).
- **SC-10** `grep -c "history.back" hooks/useExitGuard.ts` 의 호출 분기는 serializedRelease 경로에만(일반 disarm/언마운트 cleanup에는 없음). 코드 리뷰 + 테스트로 검증(grep만으론 분기 위치 판정 불가 → 테스트 SC-T6/T7가 실증).
- **SC-11** beforeunload는 **자체 핸들러 + 동기 ref 게이팅**(Plan R9 — `useBeforeUnload(when && !released)` state 의존 경로 **금지**). 검증: `grep -c "addEventListener('beforeunload'" hooks/useExitGuard.ts` ≥ 1 **그리고** 핸들러 본문이 이벤트 시점 `releasedRef.current`(+`when`)를 읽음(코드 리뷰) + serializedRelease가 cb 전 removeEventListener/disposer 호출. `grep -c "useBeforeUnload" hooks/useExitGuard.ts` = **0**(새 훅은 기존 useBeforeUnload에 의존하지 않음). 동기 disarm 실증 = 테스트 SC-T8.

### STEP 2 — `components/ExitGuardModal.tsx` 신규 (옵션 companion)
ConfirmModal 래퍼. `{promptOpen, confirmExit, cancelExit, audience?}` 받아 BackToSessions와 동일 카피로 ConfirmModal 렌더.
- **SC-12** `test -f components/ExitGuardModal.tsx` = 존재.
- **SC-13** `grep -c "ConfirmModal" components/ExitGuardModal.tsx` ≥ 1 (신규 모달 만들지 말고 재사용).

### STEP 3 — `index.ts` export 추가
- **SC-14** `grep -c "export { useExitGuard }" index.ts` = 1 (또는 동등 export 라인).
- **SC-15** `grep -c "UseExitGuardOptions\|UseExitGuardReturn" index.ts` ≥ 1 (타입 export).
- **SC-16** `grep -c "ExitGuardModal" index.ts` ≥ 1.
- **SC-17** 기존 36 export 라인 수 유지/증가만(삭제 0): `grep -c "^export" index.ts` ≥ 기존값.

### STEP 4 — `tests/useExitGuard.test.tsx` 신규
Plan 테스트 매트릭스 전 행을 jsdom popstate dispatch로 구현. 아래 §6.5 AC와 1:1.
- **SC-18** `test -f tests/useExitGuard.test.tsx` = 존재.
- **SC-19** `npm run typecheck` EXIT=0.
- **SC-20** `npm test`(= `vitest run --environment jsdom`) EXIT=0, useExitGuard 테스트 **전 케이스 pass**(SC-T1~T24 아래, Plan 매트릭스 1:1). **baseline 재현성 실측(codex SDD R5 대응)**: 현재 브랜치에서 `npm test`=**11 files / 87 tests passed, EXIT=0**, `npm run typecheck`=EXIT=0 (증거 `qa/blueprint-evidence/useexitguard.npm-test-baseline.txt`·`.typecheck-baseline.txt`). ⚠️ codex 샌드박스가 보고한 `ENOENT mkdir '/tmp/.../web'`는 **vitest 캐시 tmp 쓰기 제약(샌드박스 환경 아티팩트)**으로 레포 결함 아님 — 실 환경에서 게이트 재현됨.

### STEP 5 — `package.json` version bump
- **SC-21** `grep '"version": "0.14.0"' package.json` = 1.

## §5 API 계약
```ts
export interface UseExitGuardOptions {
  when: boolean;                       // 가드 활성(예: isDirty 또는 세션진행중)
  onConfirmExit: () => void;           // 사용자가 "나가기" 확정 시 실제 이탈 동작
  message?: string;                    // 확인 모달 본문(옵션)
}
export interface UseExitGuardReturn {
  promptOpen: boolean;                 // 확인 모달 표시
  confirmExit: () => void;             // 모달 "나가기" — serializedRelease(onConfirmExit)
  cancelExit: () => void;              // 모달 "취소" — 잔류
  releaseAndNavigate: (navigate: () => void) => void;  // 내부 이탈 — serializedRelease(navigate)
}
export function useExitGuard(opts: UseExitGuardOptions): UseExitGuardReturn;
```
- `confirmExit`·`releaseAndNavigate`는 **동일 내부 `serializedRelease(cb)`**. 순서는 **Plan ADR-1 부속 7과 정확히 일치(terminal disarm을 sentinel 소비 전에)**:
  1. `releasedRef.current = true` 동기 set
  2. **메인 popstate 핸들러 제거/바이패스**(이후 back()이 내는 popstate로 prompt 재오픈·재push 안 됨)
  3. **beforeunload 동기 disarm**(자체 핸들러 removeEventListener 또는 releasedRef 게이트로 이벤트시점 무력화)
  4. `promptOpen=false` clear
  5. **소유(`ownsSentinelRef`)일 때만** `history.back()`으로 sentinel 소비 → **one-shot release 리스너**가 popstate 완료 확인(또는 timeout fallback) → cb **정확히 1회**. 비소유면 await 없이 cb 즉시 1회.
- history.back()을 부르는 곳은 **serializedRelease 1군데뿐**. 일반 disarm·언마운트는 listener/타이머 제거만(back 금지).

## §6 UX 흐름
1. 교사/학생이 가드 화면(세션 진행/학생 빌더 등)에서 미저장(when=true) 상태로 **브라우저/하드웨어 뒤로가기** → 확인 모달(promptOpen) → "나가기"=onConfirmExit / "취소"=잔류.
2. 화면 내 "← 수업 목록/나가기"(BackToSessions) 클릭은 기존대로 BackToSessions가 confirm 담당(불변).
3. 화면을 떠나는 내부 navigate는 (슬라이스 1에서) `releaseAndNavigate(() => navigate(...))` 경유.
4. 저장 완료로 when=false가 되면 가드만 풀리고 화면 잔류(뒤로가기 강제 안 됨).

## §6.5 Acceptance Criteria (Given-When-Then) — 비개발자 검수 가능 / 테스트 1:1
- [ ] **SC-T1 (정상)** Given 가드 화면에서 when=true, When 컴포넌트가 3번 리렌더되면, Then sentinel은 단 1번만 history에 쌓인다(중복 없음).
- [ ] **SC-T2 (정상)** Given when=true, When 브라우저 뒤로가기를 누르면, Then 확인 모달이 뜨고 사용자는 그 화면에 머문다.
- [ ] **SC-T3 (정상)** Given 모달이 떴을 때, When "취소"를 2번 눌러도, Then history 길이는 변하지 않고 화면에 머문다.
- [ ] **SC-T4 (정상)** Given 모달이 떴을 때, When "나가기"를 누르면, Then onConfirmExit이 (뒤로가기 처리가 끝난 뒤) 정확히 1번 호출되고 sentinel 잔여는 0이다.
- [ ] **SC-T5 (예외)** Given "나가기" 후 뒤로가기 처리 신호가 안 와도, Then 일정 시간 뒤 대비책이 작동해 onConfirmExit이 1번 호출된다(화면에 갇히지 않음).
- [ ] **SC-T6 (경계)** Given when=true였다가 저장으로 when=false가 되어도, When 사용자가 화면에 머무르면, Then 시스템이 강제로 이전 페이지로 보내지 않는다(history.back 미호출, URL 불변).
- [ ] **SC-T7 (경계)** Given 가드 활성 중 화면이 내부 사정으로 언마운트되면, Then history.back을 부르지 않아 다른 화면 전환을 건드리지 않는다.
- [ ] **SC-T8 (예외)** Given "나가기"로 이탈 확정 후 콜백이 즉시 location.assign/지연 이동을 해도, Then 네이티브 "나가시겠습니까?"(beforeunload)가 중복으로 뜨지 않는다(동기 disarm).
- [ ] **SC-T9 (예외)** Given 이탈 확정 후 추가 뒤로가기 이벤트가 들어와도, Then 모달 재오픈·sentinel 재생성이 없다.
- [ ] **SC-T10 (정상)** Given releaseAndNavigate(navigate)를 호출하면, Then navigate 콜백은 뒤로가기 처리가 끝난 뒤에만 실행된다(동기 즉시 X), 정확히 1번.
- [ ] **SC-T11 (경계)** Given releaseAndNavigate로 이탈 후 목적지에서 브라우저 뒤로가기, Then stale sentinel 없이 정상 이전화면으로 간다.
- [ ] **SC-T12 (경계)** Given 기존 router history.state(location key 등)가 있을 때, When sentinel을 쌓고 풀어도, Then 그 router 필드가 보존된다.
- [ ] **SC-T13 (예외)** Given 같은 entry에 다른 활성 가드의 마커가 이미 있으면, When 두 번째 useExitGuard가 마운트되면, Then 자기 sentinel을 덮어쓰지 않고(passive) DEV 모드에서 "라우트당 1개" 경고를 출력한다.
- [ ] **SC-T14 (예외)** Given passive(비소유) 인스턴스에 popstate가 도달해도, Then prompt·재push·release를 하지 않는다(no-op, owner만 반응).
- [ ] **SC-T15 (예외)** Given confirmExit 중 같은 뒤로가기 신호가 2번(중복 popstate) 와도, Then onConfirmExit은 정확히 1번만 호출된다.
- [ ] **SC-T16 (경계)** Given when=true, When 뒤로가기를 연속 2번(double-back) 눌러도, Then 두 번 다 차단돼 화면 밖으로 나가지지 않는다.
- [ ] **SC-T17 (정상)** Given confirmExit로 이탈 후 목적지에서 브라우저 뒤로가기, Then stale sentinel 없이 정상 이전화면으로 간다.
- [ ] **SC-T18 (경계)** Given releaseAndNavigate 호출 시 소유 sentinel이 없으면, Then 뒤로가기 대기 없이 navigate가 즉시 1번 실행된다.
- [ ] **SC-T19 (예외)** Given releaseAndNavigate 중 뒤로가기 신호가 안 오거나(누락) 2번(중복) 와도, Then navigate는 정확히 1번 실행된다(대비책·latch).
- [ ] **SC-T20 (경계)** Given 가드 화면에서 내부 navigate/Link로 새 라우트가 push된 뒤 언마운트되면(소유권 마커≠내 uid), Then cleanup이 history.back을 부르지 않아 새 라우트가 유지된다(루프 없음).
- [ ] **SC-T21 (경계)** Given 프로그램적 redirect로 새 라우트 push 후 언마운트, Then 동일하게 history.back 미실행·redirect 목적지 유지.
- [ ] **SC-T22 (경계, bounded — 통제된 remount 한정, codex SDD R6 [high])** Given **통제된 테스트 하니스에서 가드 화면이 실제로 remount되는 경우에 한해**, releaseAndNavigate를 안 거치고 생 navigate로 떠난 뒤 stale entry(가드 URL)에 재마운트되면, Then 재arm은 idempotent(sentinel 마운트당 ≤1·무한 중복 0)이고 listener-less phantom이 없다. ⚠️ **이 단정은 "guard 화면이 remount된다"는 조건부 bounded 속성만 검증**한다. **redirect/auth-gated/route-loader로 guard 화면이 remount되지 않는 raw-navigate 경로는 Slice 0가 보장하지 못함**(라우터 무관 훅 + 앱 라우트 무변경) — 그런 경로는 **Slice 1 blocking 인벤토리**에서 releaseAndNavigate 또는 명시적 confirm/useBlocker로 커버(아래 한계 명시 + Plan ADR-5).

- [ ] **SC-T23 (예외, 재진입 — Plan ADR-1부속7/매트릭스 "재진입" 행, codex SDD R2 [high])** Given confirmExit로 이탈 확정 후 onConfirmExit이 ⓐ`history.back()` ⓑ`location.assign(...)` ⓒ지연 router navigate 중 하나를 하고 컴포넌트가 **≥1 tick 마운트 유지**되면, Then **prompt 재오픈 count=0 AND sentinel 재push count=0**(terminal disarm이 메인 popstate/rearm을 이미 껐기 때문). 3개 변형 각각 검증.
- [ ] **SC-T24 (예외, 소유권-skip 전 분기 — Plan 소유권 원칙, codex SDD R2 [medium])** Given `history.state.__tmExitGuard`가 **다른 uid**로 바뀐 상태에서, When `confirmExit`과 `releaseAndNavigate`를 각각 호출하면, Then **history.back은 호출되지 않고**(비소유라 skip) 콜백(onConfirmExit/navigate)은 **정확히 1번** 실행된다. (back 보정은 모든 serializedRelease 진입점에서 `ownsSentinelRef`·마커 일치 시에만.)

> **1:1 추적성(codex SDD R1/R2 [high])**: 위 SC-T1~T24가 Plan 테스트 매트릭스 + ADR-1부속 계약 전 행을 빠짐없이 커버. 매핑 — T1=리렌더 idempotent / T2=뒤로가기 차단·재push / T3=cancel 반복 / T4=confirmExit ordering / T5=confirmExit fallback / T15=confirmExit 중복 popstate / T16=double-back / T17=confirmExit 후 Back / T6=when→false 일반disarm / T7=언마운트 / T8=동기 beforeunload disarm·location.assign / T9=release 후 popstate no-op / **T23=재진입 confirmExit 3변형(prompt 재오픈0·재push0)** / T10=releaseAndNavigate ordering / T11=releaseAndNavigate 후 Back / T18=releaseAndNavigate 무소유 즉시 / T19=releaseAndNavigate 누락·중복 / T12=router state 보존 / T13=중첩 가드 DEV 경고 / T14=passive no-op / T20=내부push→언마운트 소유권skip / T21=redirect→언마운트 / T22=미조정 생navigate stale bounded / **T24=소유권-skip을 confirmExit·releaseAndNavigate 양쪽 진입점에 적용**.

## §7 구현 노트 의무
본 PR은 IMPLEMENTATION-NOTES-POLICY 적용 대상. Generator는 `docs/implementation-notes/PR-pending-useexitguard.md`에 Decisions/Changes/Tradeoffs/Notes 4섹션을 STEP마다 누적 갱신.

## Slice 0가 보장하지 못하는 것 (한계 — codex SDD R6, Plan ADR-5)
- **redirect/auth-gated/route-loader로 guard 화면이 remount되지 않는 raw-navigate 이탈** — router 무관 훅 + 앱 라우트 무변경이라 Slice 0가 stale-sentinel 안전을 강제 못 함. → **Slice 1 blocking 인벤토리 의무**: 그런 경로는 releaseAndNavigate 또는 명시적 confirm/useBlocker로 커버해야 그 앱이 "가드 적용됨"으로 인정.
- bounded stale sentinel(미조정 이탈)은 수용된 한계(Plan ADR-5).
- **매우 지연된(grace 창 초과) 뒤로가기 traversal의 물리 위치 어긋남 (codex R5/R9/R10, ADR-4/ADR-5 수용)** — `releaseAndNavigate`/`confirmExit`에서 정상적으로는 `history.back()`의 popstate가 즉시(<16ms) 도착해 sentinel 소비 후 cb가 실행된다(경합 없음). 그러나 popstate가 fallback 창(50ms) 내 안 오면 dead-exit 방지를 위해 cb를 먼저 실행하고, late traversal은 grace 창(200ms) 동안 흡수·URL 복원한다. **grace 초과로 도착하는 극단적 지연 traversal(jank/BFCache)은 흡수 못 해 사용자가 목적지에서 밀릴 수 있다.** router-agnostic 훅은 native 뒤로가기를 취소·정확히 귀속할 수 없어 근본적으로 완전 차단 불가 — Data Router 앱의 정밀 차단은 **ADR-4 어댑터 슬라이스(useBlocker 병행)**에서 다룬다. fallback 발화는 DEV `console.warn`으로 **관측 가능(fail-closed 신호)**. 정상 환경에서는 발생하지 않는 edge-of-edge.

## Out of Scope (SDD 재확인)
앱 코드 변경 / 4개 비소비 앱 dep 추가 / 앱 내부 이탈경로 인벤토리 / Data Router 어댑터 실구현 / 중첩 dirty 가드 arbiter / 기존 useBeforeUnload·BackToSessions·DirtyGuard 동작 변경 — 전부 범위 밖(Plan Out of Scope).
