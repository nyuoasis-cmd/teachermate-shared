# Implementation Notes — useExitGuard 공유 훅 (뒤로가기 가드 에픽 슬라이스 0)

> 단일 진실 소스: `PLAN-useexitguard.md`(ADR-1 부속) + `docs/SDD-useexitguard-v1.md`(SC-1~21, SC-T1~T24).
> 본 PR 범위: 공유 패키지만(`@teachermate/shared` 0.13.0→0.14.0). 앱 코드 0줄 변경.

## Decisions
- **popstate sentinel 방식 채택**(ADR-1, 안 B). useBlocker 미사용 → react-router optional peer 계약 준수, ~10개 혼합 라우터 앱에서 라우터 마이그레이션 없이 동작.
- **단일 소유자 게이팅**(`ownsSentinelRef`): 한 entry의 sentinel을 한 인스턴스만 소유. passive 인스턴스의 popstate는 완전 no-op. 모듈 레지스트리(`activeExitGuardUids`)로 중첩 가드 충돌 감지.
- **terminal disarm 먼저, cb 나중**: `serializedRelease`가 ① `releasedRef` 동기 set ② setPromptOpen(false) ③ 소유 시 history.back() ④ one-shot popstate 또는 fallback 후 cb 정확히 1회. confirmExit·releaseAndNavigate 둘 다 이 단일 경로 공유.
- **beforeunload 자체 핸들러 + 동기 ref 게이팅**: 기존 `useBeforeUnload` 미사용. 이벤트 시점 `releasedRef.current`/`whenRef.current`를 읽어 confirmed-exit cb가 location.assign/지연 nav를 해도 네이티브 이중 프롬프트가 안 뜸(effect cleanup 대기 X).
- **history.back() 단일 호출처**: serializedRelease에서, 그것도 `ownsSentinelRef && history.state.__tmExitGuard===자기 uid`일 때만. 일반 disarm(when→false)·언마운트 cleanup은 절대 back() 안 함 → bounded stale 1개 수용(ADR-5).
- **DEV 경고 빌드 호환 감지(SC-9)**: `(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true`. 리터럴 형태는 tsc `types:[react,react-dom]`에서 typecheck 실패 → 금지(SC-9b grep-negative=0).
- **router state 보존(SC-4)**: `pushState({ ...window.history.state, __tmExitGuard: uid }, '', location.href)` spread merge — location key/idx 등 router 필드 생존.

## Changes
- `hooks/useExitGuard.ts` (신규) — 훅 본체. `UseExitGuardOptions`/`UseExitGuardReturn` 타입 + `useExitGuard()`.
- `components/ExitGuardModal.tsx` (신규) — ConfirmModal 재사용 래퍼(신규 모달 0). `{promptOpen, confirmExit, cancelExit, audience?, message?}`.
- `index.ts` — `useExitGuard`/`ExitGuardModal` + 타입 5종 export 추가(기존 export 삭제 0).
- `tests/useExitGuard.test.tsx` (신규) — SC-T1~T24 전 케이스(jsdom popstate dispatch, history.back 모킹+수동 popstate로 traversal 결정적 제어). 28 it 블록(T19/T23/T24 분할).
- `package.json` — version 0.13.0 → 0.14.0.

## Tradeoffs
- **앱 내부 SPA 네비(Link/navigate/redirect) 미차단** — popstate 미발생. 슬라이스 1에서 각 앱이 releaseAndNavigate로 감싸거나 BackToSessions로 confirm 담당(인벤토리 blocking AC).
- **bounded stale sentinel** — 미조정 이탈/일반 disarm/언마운트 시 stale entry 1개 잔존 가능. 통제 remount되는 경우엔 재arm으로 phantom 없음. redirect/auth-gated/route-loader로 **guard 화면이 remount되지 않는 raw-navigate 경로는 Slice 0 미보장** → Slice 1 인벤토리 의무(SC-T22 한계 명시).
- **테스트 결정성 위해 history.back을 spy로 모킹** — jsdom의 비결정적 traversal/popstate를 피하려고 back()을 no-op spy로 두고 popstate를 수동 dispatch. exactly-once·ordering·fallback은 호출 카운트와 cb 호출 횟수로 검증. 실제 traversal 동작은 block-design 레퍼런스 패턴(검증됨)에 의존.

## Codex adversarial-review 트레일
- **R1 = needs-attention** (실호출 `adversarial-review --wait --base main`, verdict 원문 인용). [high] 2건:
  1. *버전-스큐 소유권 덮어쓰기* — 모듈-로컬 `Set`이라 타 번들/버전의 활성 sentinel을 못 봐 `pushState`로 덮어씀(Plan "타 번들" 충돌경계 R10/R11 미충족). → **수정: 소유권 레지스트리를 window-global(`window.__tmExitGuardOwners`)+global seq(`__tmExitGuardSeq`)로 이전.** 레지스트리에 있는 문자열 마커는 점유(passive), 없는 문자열 마커는 stale로 간주(재arm 허용=SC-T22 보존). SSR 폴백 포함. 회귀 테스트 **SC-T13c** 추가(외부 활성 마커 → 덮어쓰기 0·passive).
  2. *fallback 후 late popstate 경합* — 50ms fallback이 listener를 떼고 cb 실행 후 늦은 traversal 도달 시 경합. → **수정: fallback이 cb 실행 후에도 listener를 유예(`RELEASE_FALLBACK_GRACE_MS=200`) 유지해 late popstate를 idempotent 흡수(`settled` latch)**, 언마운트 시 `pendingReleaseTeardownRef`로 정리(누수 0). 회귀 테스트 **SC-T19c** 추가(fallback 선발화 + late popstate → navigate 정확히 1회·재arm 0). ⚠️ 물리적 브라우저 traversal 위치는 popstate-async 방식의 bounded 한계(ADR-5)로 잔존 — 상태머신은 exactly-once·no-rearm 보장.

- **R2 = needs-attention** ([high]1 + [medium]1):
  1. *(high) late-popstate 물리 위치* — grace 흡수는 cb dedup만, 늦은 traversal이 navigation을 물리적으로 되돌릴 수 있음. → **수정: fallback이 cb 실행 시 목적지 `intendedHref` 기록 → late popstate 도착 시 URL이 목적지를 벗어났으면 `pushState`로 best-effort 복원.** 회귀 **SC-T19d**(URL 위치 복원 검증). ⚠️ router-agnostic 한계상 URL 위치만 복원, router 상태 재동기화는 ADR-4 어댑터 슬라이스 + bounded(ADR-5)로 명시.
  2. *(medium) passive guard beforeunload 누수* — `onBeforeUnload`가 `ownsSentinelRef` 미확인 → 버전-스큐/중첩 시 passive 인스턴스가 owner release 후에도 native unload 차단. → **수정: `onBeforeUnload`에 소유권 게이트 추가(passive는 beforeunload도 막지 않음, owner가 담당).** 회귀 **SC-T8b**(owner release 후 passive 미차단).

- **R3 = needs-attention** ([medium]1): *throwing release callback이 listener/timer를 strand* — `runCb`가 cb 호출 후 teardown 도달 못해 cb throw 시 popstate listener+`pendingReleaseTeardownRef` 누수. → **수정: `serializedRelease`를 예외-안전화 — `runCb`/onReleasePop/fallback 타이머 전부 `try/finally`로 teardown(또는 grace 예약) 보장, 에러는 정리 후 전파.** 회귀 **SC-T19e**(cb throw 후 listener/타이머 정리·late popstate 무해).

- **R4 = needs-attention** ([high]1): *late-popstate 흡수가 navigate-unmount에 취약* — R2/R3에서 둔 `pendingReleaseTeardownRef`를 언마운트 cleanup이 무조건 정리 → 실제 `releaseAndNavigate`가 라우트 전환으로 훅을 언마운트하면 grace 흡수 listener가 죽어 늦은 traversal 복원 불가. → **수정: release 흡수 컨트롤러(onReleasePop+fallback/grace 타이머)를 컴포넌트 라이프사이클과 독립화 — `pendingReleaseTeardownRef` 제거, 언마운트는 release 컨트롤러를 건드리지 않음. 정상 popstate(즉시) 또는 grace 만료(최대 50+200ms)로 self-tear → 무한 누수 없음.** 회귀 **SC-T19f**(fallback navigate가 언마운트해도 late popstate 흡수·복원).

- **R5 = needs-attention** ([high]1 + [medium]1):
  1. *(high) 실패 cb가 가드를 영구 무력화* — `releasedRef=true`를 cb 전에 set하므로 cb가 throw(이탈 실패)하면 dirty 페이지가 무방비. → **수정: cb throw 시 마운트 유지·`when=true`면 `releasedRef=false`+`armSentinel()`로 가드 복구(`restoreOnFailure`), `mountedRef`로 죽은 인스턴스 재arm 방지.** 회귀 **SC-T19e**(throw→복구, beforeunload·back 재가동)·**SC-T19e2**(언마운트 인스턴스 복구 0).
  2. *(medium) grace 200ms 후 late traversal 미흡수* — codex 권고("관측까지 유지")는 **더 나쁜 버그**(한참 뒤 무관한 popstate를 늦은 traversal로 오인→URL 하이재킹)를 유발. grace window는 사실 **의도적 귀속 경계**(back()의 popstate 실측 <16ms, 200ms=10배 마진). 따라서 bounded 유지 + **수정: 의도 명문화 + 회귀 SC-T19g(grace 경과 후 무관 popstate는 하이재킹 0=안전).** 물리 traversal/router 재동기화는 router-agnostic 한계(ADR-4/ADR-5).

- **R6 = needs-attention** ([high]1): *async 이탈 콜백 reject가 복구를 우회* — `restoreOnFailure`가 동기 throw만 잡아, async cb가 reject되면 가드가 영구 무력화(`() => void` 타입이어도 호출자가 async 전달 가능). → **수정: 콜백 계약을 `ExitGuardCallback = () => void | Promise<void>`로 확장(하위호환, ConfirmModal 패턴과 정합), `watchAsync`로 owned/non-owned 양 경로의 promise reject도 동일 teardown+복구.** 회귀 **SC-T19h**(owned async reject 복구)·**SC-T19h2**(non-owned async reject 복구). 타입 `ExitGuardCallback` export 추가.

- **R7 = needs-attention** ([medium]1): *StrictMode 재마운트 후 복구 비활성* — `mountedRef`가 cleanup에서 false로 고정되고 setup이 복원 안 해, StrictMode(setup→cleanup→setup) 후 async reject 복구가 skip(dev/QA 모드). → **수정: 마운트 effect setup 첫 줄에서 `mountedRef.current = true` 복원.** 회귀 **SC-T19i**(StrictMode 재마운트 후 async reject 복구)·**SC-T1b**(StrictMode 더블마운트 idempotent push=1).

- **R8 = needs-attention** ([high]1): *stale 소유권 재arm 구멍* — disarm 중 Back으로 sentinel이 소비되면 `ownsSentinelRef`는 true인데 마커가 사라져, 재편집 시 `if(owns) return`이 재push를 건너뛰어 sentinel 없이 무방비. → **수정: idempotent skip을 `owns && readSentinelMarker()===uid`로 강화 — 소유권 플래그만 믿지 않고 실제 `history.state` 마커와 재조정.** 회귀 **SC-T6b**(disarm→Back 소비→재편집 시 새 sentinel push + 가드 복원).

- **R9 = needs-attention** ([high]1): *async 성공 시 fallback URL 복원이 stale 캡처로 yank* — R6(async)+R2(URL복원) 결합 결함. `runCb`가 cb 직후 `intendedHref`를 캡처하나 async cb는 promise만 반환(네비 전)이라 가드 URL을 잡음 → late popstate가 사용자를 가드 페이지로 되돌림. → **수정: thenable이면 `intendedHref=null`(대기 중 위치복원 비활성), promise resolve(=네비게이션 후) 시점에만 목적지 URL 기록.** 회귀 **SC-T19j**(async await 후 네비 + late popstate → yank 0).

- **R10 = needs-attention** ([high]1, R5 finding2 재제기 = 고정 grace window): *grace 초과 late traversal 미흡수* — codex 권고 #1(정확한 traversal 귀속)은 back()의 popstate를 태깅 불가라 구현 불가, "무한 유지"는 무관한 popstate 하이재킹(더 나쁜 버그). → **codex 권고 #3(fail-closed + observable) 채택: fallback 발화 시 DEV `console.warn`으로 비정상 상황을 관측 가능하게 + SDD 한계절·본 노트에 명문화.** 회귀 **SC-T19k**(fallback→경고). **🔑 master 판단(round cap 10): 잔여(grace 초과 극단 지연 traversal의 물리 위치 어긋남)는 router-agnostic popstate 가드의 본질적 한계로, native 뒤로가기를 취소·귀속할 수 없어 완전 차단 불가 = Plan ADR-4(router 어댑터 deferred)/ADR-5(bounded) 수용 범위의 비치명 edge-of-edge. 정상 환경(<16ms popstate)에선 미발생. Data Router 정밀 차단은 슬라이스의 ADR-4 확장점에서.**

## Notes
- 검증: `npm run typecheck` EXIT 0, `npm test` 12 files / **130 tests passed**(87 baseline + 43 신규, 회귀 0).
- baseline(브랜치 clean 시점): 11 files / 87 tests, typecheck EXIT 0 — `qa/blueprint-evidence/useexitguard.*` 참조.
- 슬라이스 1~3은 별도 레포 PR(별도 blueprint/AO 런). Stacked PR 없음 — 머지 후 각 앱 `npm install`로 `#main` 갱신.
