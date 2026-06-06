# HANDOFF — useExitGuard 공유 훅 (뒤로가기 가드 에픽 슬라이스 0)

## §0 메타
| 항목 | 값 |
|------|-----|
| repo | nyuoasis-cmd/teachermate-shared (`@teachermate/shared`) |
| branch | `feat/useexitguard` (이미 생성됨, Plan/SDD/evidence 커밋 적재) |
| base | `main` |
| 산출 | 0.13.0 → **0.14.0** |
| 설계(승인) | `PLAN-useexitguard.md`(codex R13 approve) · `docs/SDD-useexitguard-v1.md`(codex R8 approve) |
| 증거 | `qa/blueprint-evidence/useexitguard.codex.md`·`.preflight.md`·`.npm-test-baseline.txt`·`.typecheck-baseline.txt` |

### 🚨 구현 경로 결정 (Plan 미결 #1) — **AO 아님, 새 세션 master 직접 구현 권장**
`teachermate-shared`는 `scripts/ao/config.yaml`에 **미등록**. 슬라이스 0 = 시각 산출물 없는 ~60줄 훅 + 모달 + 단위테스트(SC-T1~T24). AO Generator/Eval-Visual(시각)/Eval-Interaction 매트릭스 부적합. → **새 세션 master가 SDD Sprint Contract대로 직접 구현 + codex review(diff) + `npm test`/`npm run typecheck`로 검증**이 본질에 맞음. (AO 등록은 비시각 단위테스트 패키지엔 오버헤드.) **jery가 AO 경로를 원하면 config 등록 후 전환 가능 — 그 경우만 사전 고지.**

본 PR은 IMPLEMENTATION-NOTES-POLICY 적용 대상. 구현자는 `docs/implementation-notes/PR-pending-useexitguard.md`에 Decisions/Changes/Tradeoffs/Notes 4섹션 누적.

---
## §A 구현 (SDD §3 Sprint Contract 준수)
**STEP 1 — `hooks/useExitGuard.ts`** (SC-1~11, SC-9b). Plan ADR-1 부속(소유권 원칙·항목 1~9·충돌경계·terminal disarm·fallback)이 단일 진실 소스. 핵심:
- popstate + `pushState({ ...history.state, __tmExitGuard: uid }, '', location.href)` (router state 보존, SC-4).
- 단일 소유자: `ownsSentinelRef` — popstate prompt/repush·serializedRelease back 보정 전부 소유 시만(SC-6). passive 인스턴스 no-op + DEV 경고(빌드호환 캐스트 SC-9, 리터럴 금지 SC-9b).
- `serializedRelease(cb)` 공용 프리미티브: releasedRef 동기 set → 메인 popstate listener 제거 → beforeunload 동기 disarm(자체 핸들러 + releasedRef 이벤트시점 게이팅, SC-11; `useBeforeUnload` 미사용) → promptOpen clear → 소유 시 history.back() → one-shot popstate/timeout fallback → cb 정확히 1회. confirmExit·releaseAndNavigate 둘 다 이 경로.
- 일반 disarm(when→false)·언마운트 cleanup = **listener/타이머 제거만, history.back() 금지**(SC-10, SC-T6/T7).

**STEP 2 — `components/ExitGuardModal.tsx`** (SC-12/13): ConfirmModal 재사용 래퍼 `{promptOpen, confirmExit, cancelExit, audience?, message?}`, BackToSessions 카피.

**STEP 3 — `index.ts`** (SC-14~17): `useExitGuard` + 타입 2종 + `ExitGuardModal` export 추가(기존 36 export 삭제 0).

**STEP 4 — `tests/useExitGuard.test.tsx`** (SC-18~20): SC-T1~T24 전 케이스(jsdom popstate dispatch). Plan 매트릭스 1:1.

**STEP 5 — `package.json`** version 0.14.0 (SC-21).

절대 규약: 작업 branch = `feat/useexitguard`. 별도 브랜치/PR 무단 생성 금지. 기존 useBeforeUnload·BackToSessions·DirtyGuard·ConfirmModal 동작 변경 금지(재사용만).

## §B 검증 (Eval = 단위테스트 + codex)
1. **Sprint Contract grep** SC-1~9b 충족(파일 존재·심볼·리터럴 금지 grep-negative).
2. **`npm run typecheck`** EXIT=0 (DEV 캐스트 컴파일 — preflight 확인됨).
3. **`npm test`** EXIT=0, useExitGuard 24 케이스 전부 pass + 기존 87 baseline 회귀 0.
4. **codex review(diff)** — `node $PLUGIN/scripts/codex-companion.mjs adversarial-review --wait --base main "useExitGuard 구현이 SDD SC-T1~T24·Plan ADR-1 부속 계약(소유권 게이팅·serializedRelease terminal disarm 순서·비동기 fallback·router state merge·일반disarm back금지) 충족하나, 테스트가 happy-path만이 아닌 경합/재진입/소유권skip 실증하나"`. needs-attention이면 수정 후 재호출(APPROVED까지, round cap 10).
5. ⚠️ codex 샌드박스가 `npm test` ENOENT(/tmp mkdir) 내면 환경 아티팩트 — 실 환경 `npm test` 결과로 판정(증거 baseline 참조).

## §C PR
- 제목(명시형): `feat(shared): useExitGuard 뒤로가기 가드 공유 훅 + ExitGuardModal (뒤로가기 가드 에픽 1/N, 슬라이스 0)`
- 본문: Out of Scope(앱 적용=슬라이스 1~3 / 4앱 dep 추가 / 내부 이탈경로 인벤토리 / Data Router 어댑터 / 중첩가드 arbiter) + GWT AC(SC-T1~T24 평문) + 한계(no-remount raw-navigate는 Slice 1 인벤토리) + 클릭 가능 PR URL.
- 머지 후: 각 소비 앱이 `npm install @teachermate/shared`로 `#main` 갱신해야 0.14.0 반영(슬라이스 1에서). Stacked PR 없음.

## §D 다음 (슬라이스 1~3, 별도 blueprint/AO 런)
- 슬라이스 1: 가드 적용 7앱(전무 6 + beforeunload 승격) + 4앱 dep 추가 + **앱별 내부 이탈경로 blocking 인벤토리**(releaseAndNavigate 커버, no-remount redirect/auth/loader 경로 명시 커버).
- 슬라이스 2: 교사 공통 네비(§9.H-19, useExitGuard 무관 별개).
- 슬라이스 3: 복귀 링크(BackToSessions).
