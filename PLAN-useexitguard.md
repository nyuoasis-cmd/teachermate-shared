# Plan — teachermate-shared `useExitGuard` 공유 훅 (뒤로가기 가드 에픽 슬라이스 0)

## 목적
세션·학생 화면에서 **브라우저/하드웨어 뒤로가기**로 앱 밖 이탈하는 것을 막는 표준 훅 `useExitGuard`를 공유 패키지 `@teachermate/shared`에 신설한다. DESIGN-POLICY §9.H-18(popstate/useBlocker 의무, beforeunload는 보조 격하)을 **단일 소스**로 충족하고, 후속 슬라이스 1~3(앱별 적용)이 모두 이 훅을 import 하도록 한다. 이번 슬라이스는 **공유 패키지만** 변경하며 앱 코드는 건드리지 않는다.

## 현재 상태 (실측)
- `@teachermate/shared` v0.13.0, `main` 브랜치 clean. 소비 앱은 `github:nyuoasis-cmd/teachermate-shared#main` 로 6개(sprint·ai-app-builder·ai-music-video·meta-character·portfolio·block-design)가 코드 import. 4개(data-class·kospi-1980·vibe·sangkwon)는 dep 자체 없음(후속 슬라이스에서 dep 추가 — jery 결정).
- **빌드/배포**: `prepare` 스크립트(`tsc`)가 consumer `npm install` 시 dist를 빌드. `.gitignore`에 `dist/` → **dist 커밋 불필요**. `main`(./dist/index.js, ./dist/index.d.ts) export.
- **react-router-dom 은 optional peer dep** (`package.json` peerDependenciesMeta.react-router-dom.optional=true). 공유 훅이 `useBlocker`(react-router Data Router 전용 API)에 하드 의존하면 optional 계약 위반 + Data Router 미사용 앱에서 런타임 깨짐.
- 기존 프리미티브(재사용 대상):
  - `hooks/useBeforeUnload.ts` — `useBeforeUnload(isDirty, {enabled})` beforeunload만. 탭 닫기/새로고침 confirm. **SPA 내부 뒤로가기 못 막음**.
  - `components/useDirtyGuard.tsx` — `DirtyGuardProvider({threshold=50})` / `useDirtyGuardContext()` → `{isDirty, markDirty(delta), reset()}`. 내부에서 useBeforeUnload 호출.
  - `components/BackToSessions.tsx` — `{audience:'teacher'|'student'}`. useDirtyGuardContext 사용, dirty면 ConfirmModal → `navigate('/dashboard'|'/join')`. **앱 내부 "나가기 버튼" 클릭** 경로 담당(브라우저 뒤로가기는 미담당).
  - `components/ConfirmModal.tsx` — 확인 모달 (title/description/confirmLabel/cancelLabel/variant).
- 레퍼런스 진짜 가드 2종(추출 대상 패턴):
  - block-design `src/pages/DesignPage.tsx:48-62` — `window.history.pushState({...},'')` + `popstate` → 핸들러 실행. **라우터 무관**(History API 직접).
  - ar-storybook `src/pages/Create.tsx:103-109` — `useBlocker(hasUnsavedData)` → `blocker.state==='blocked'` → confirm modal. **Data Router 필요**.
- 테스트: `tests/*.test.tsx` vitest+jsdom 패턴 보유(`useBeforeUnload.test.tsx` 포함). `npm test` = vitest run.

## 변경 범위 (이번 슬라이스 = 공유 패키지 한정)
| 파일 | 변경 |
|------|------|
| `hooks/useExitGuard.ts` | **신규** — 훅 본체 (popstate + pushState 기반, 라우터 무관) |
| `components/ExitGuardModal.tsx` | **신규(옵션)** — ConfirmModal 래퍼. 앱별 모달 보일러플레이트 제거. BackToSessions 카피와 동일 문구 기본값 |
| `index.ts` | export 2~3줄 추가 (훅 + 타입 + 옵션 모달) |
| `tests/useExitGuard.test.tsx` | **신규** — jsdom popstate 시뮬레이션 단위 테스트 |
| `package.json` | version `0.13.0` → `0.14.0` |
| 앱 코드 | **변경 없음** (Out of Scope — 슬라이스 1~3) |

## 아키텍처 3안 비교 — 뒤로가기 가드 구현 방식
같은 기준으로 비교. (앱들의 라우터 구성이 `<BrowserRouter>`(declarative)와 `createBrowserRouter`(Data Router)로 혼재 → 호환성이 핵심 기준)

| 기준 | 안 A: `useBlocker` | 안 B: `popstate`+`pushState` (추천) | 안 C: 하이브리드 |
|------|------|------|------|
| 1. 동작 원리 | react-router Data Router 네비게이션 가로채기 | History API 직접: sentinel state push 후 popstate 감지 | popstate 기반 + Data Router 감지 시 useBlocker 병행 |
| 2. 라우터 요구 | **Data Router 필수**(`createBrowserRouter`). `<BrowserRouter>` 앱은 라우터 마이그레이션 필요 | **무관** — 어떤 라우터든 동작 | 무관(폴백) but Data Router 경로 별도 |
| 3. optional peer 계약 | **위반**(react-router 하드 의존) | 준수(react-router 미사용 가능) | 부분 — 조건부 import 필요 |
| 4. 차단 범위 | 브라우저 뒤로가기 + 앱 내부 `<Link>`/navigate 전부 | 브라우저/하드웨어 뒤로가기(popstate). 앱 내부 네비는 BackToSessions가 담당 | 둘 다 |
| 5. 구현 복잡도 | 낮음(API 1개) but 앱측 라우터 전환 비용 큼 | 중(pushState 누수/중복 push 관리 필요) | **높음**(두 경로 + 분기) |
| 6. 기존 패턴 일관성 | ar-storybook 1곳만 사용 | block-design이 이미 사용(레퍼런스) | 신규 |
| 7. 테스트 용이성 | Data Router 모킹 필요 | jsdom popstate dispatch로 단위 테스트 가능 | 두 경로 테스트 |
| 8. §9.H-18 충족 | ✅(useBlocker 명시) | ✅(popstate 명시) | ✅ |
| 9. 후속 슬라이스 파급 | ~10앱 중 BrowserRouter 앱 라우터 마이그레이션 강제 = 큰 ripple | dep만 추가/import = 작은 변경 | 중간 |

> **[GATE] 안 선택 = jery 결정.** AI 추천 = **안 B (popstate + pushState, 라우터 무관)**.
> 근거: (1) 공유 패키지에서 react-router는 optional peer — useBlocker 하드 의존은 계약 위반이고 Data Router 미사용 앱에서 깨짐. (2) 안 A는 후속 슬라이스에서 `<BrowserRouter>` 사용 앱들에 라우터 마이그레이션을 강제 → 슬라이스 1~3 비용/리스크 폭증(파급 큼). (3) block-design이 이미 popstate로 동작 = 검증된 레퍼런스. (4) §9.H-18은 "popstate **또는** useBlocker"를 인정하므로 popstate로 정책 충족. (5) 앱 내부 "나가기" 클릭 경로는 이미 BackToSessions가 confirm 담당 → useExitGuard는 브라우저/하드웨어 뒤로가기만 책임지면 역할 분담이 깔끔.

## 결정 사항 (ADR)
### ADR-1: popstate sentinel 방식 채택
- **Context** — 공유 훅은 ~10개 혼합 라우터 앱에서 동작해야 하고, react-router는 optional peer.
- **Decision** — `pushState` 로 sentinel history entry를 쌓고 `popstate` 로 뒤로가기를 감지. 가드 활성 중이고 미저장이면 확인 모달을 띄우고 sentinel을 재push해 사용자를 페이지에 잔류시킴.
- **Alternatives** — (A) useBlocker: optional peer 위반 + 라우터 마이그레이션 강제로 거부. (C) 하이브리드: 복잡도 대비 이득 미미(popstate만으로 §9.H-18 충족)로 거부.
- **Consequences** — 장점: 라우터 무관, 검증된 패턴, 단위 테스트 용이, 후속 슬라이스 변경 최소. 단점: ① 앱 내부 `<Link>`/navigate 네비게이션은 막지 않음(아래 "범위 경계" + Out of Scope에서 명시, 슬라이스 1 인벤토리로 보강). ② history에 sentinel entry를 쌓으므로 생명주기를 정확히 관리해야 "뒤로가기 두 번 눌러야 나가짐"·history 무한증가·중복 sentinel 누수를 방지. **이 contract가 슬라이스 0의 핵심 산출물이므로 SDD로 미루지 않고 아래에 박는다(codex R1 [high] 반영).**

### ADR-1 부속: sentinel 생명주기 계약 (슬라이스 0에서 확정 — 모든 앱 슬라이스가 import하는 contract)
1. **단 하나의 sentinel만 유지(idempotent)** — `when`이 false→true로 바뀌는 시점에만 sentinel을 1회 push. 리렌더·동일 `when` 값 반복에서는 추가 push 금지(이전 push 여부를 ref로 기억).
2. **차단 시 재push** — popstate로 뒤로가기가 감지되고 `when===true`이면, 확인 모달을 열고 sentinel을 **정확히 1개** 재push해 사용자를 페이지에 잔류시킴(중복 push 금지).
3. **confirmExit** — 가드 해제(listener 제거 + 잔류 sentinel 1개를 history.back()으로 소비) 후 `onConfirmExit()` 호출. 이중 back/잔여 entry 0 보장.
4. **cancelExit** — 모달만 닫음. 2번에서 이미 sentinel이 재push되어 있으므로 추가 history 조작 없음(중복 방지).
5. **`when`이 true→false** — sentinel을 소비(history 보정)하고 popstate listener 제거. 잔여 entry 0.
6. **언마운트** — cleanup에서 listener 제거 + 미소비 sentinel 보정. 가드가 활성인 채 언마운트돼도 history 누수 0.
7. **호출자 책임 명확화** — `onConfirmExit`은 "실제 이탈 동작"(navigate/leave)만 담당. 훅은 history/모달 상태만 관리.

### 테스트 매트릭스 (슬라이스 0 AC — jsdom popstate dispatch, codex R1 [high] 반영)
| 시나리오 | 기대 |
|---------|------|
| `when=true` 진입 → 리렌더 3회 | sentinel push **1회만**(idempotent) |
| `when=true` + 뒤로가기(popstate) | promptOpen=true, 잔류, sentinel 재push 1개 |
| 모달에서 cancelExit 반복 2회 | history 길이 불변(중복 push 0), 잔류 |
| 모달에서 confirmExit | onConfirmExit 1회 호출, 잔여 sentinel 0 |
| double-back(뒤로가기 2연타) | 첫 back에서 차단, 두 번째도 차단(나가지지 않음) |
| `when` true→false 전환 | listener 제거, 잔여 sentinel 0 |
| 가드 활성 상태로 언마운트 | history 누수 0, listener 제거 |

### ADR-2: 기존 DirtyGuard/ConfirmModal 재사용, 신규 상태머신 금지
- **Context** — isDirty 추적·확인 모달·나가기 카피가 이미 공유 패키지에 존재.
- **Decision** — useExitGuard는 dirty 판정을 **호출자 주입**(`when` prop)으로 받고, 모달은 ConfirmModal(또는 그 래퍼 ExitGuardModal)을 재사용. 독자적 dirty 상태나 모달을 새로 만들지 않음.
- **Alternatives** — DirtyGuardContext를 훅 내부에서 강제 구독 → 거부(Context 미설치 앱에서 throw, 결합도↑). `when` 주입이 더 유연.
- **Consequences** — 호출자가 `when`(예: `isDirty` 또는 `세션진행중`)과 `onConfirmExit`(실제 이탈 동작)을 넘김. 카피 일관성은 ExitGuardModal 기본값으로 유지.

### ADR-3: API 형태 — 훅은 상태 반환, 모달은 호출자 렌더
- **Decision** —
  ```ts
  interface UseExitGuardOptions { when: boolean; onConfirmExit: () => void; message?: string; }
  interface UseExitGuardReturn { promptOpen: boolean; confirmExit: () => void; cancelExit: () => void; }
  function useExitGuard(opts: UseExitGuardOptions): UseExitGuardReturn;
  ```
  추가로 `useBeforeUnload(when)`을 내부 호출해 탭 닫기(보조)도 함께 커버.
- **Alternatives** — 훅이 모달까지 렌더(JSX 반환) → 거부(훅은 JSX 반환 안 함, React 규약). 대신 옵션 컴포넌트 `<ExitGuardModal {...guard} />` 제공.
- **Consequences** — ar-storybook의 `{blocker.state}` 패턴과 유사한 사용성. 앱은 `const guard = useExitGuard({when, onConfirmExit}); ... <ExitGuardModal {...guard} />`.

### ADR-4: Data Router 앱을 위한 전방호환 확장점 (codex R1 [medium] 반영)
- **Context** — popstate-only는 Data Router 앱에서 useBlocker 대비 약함(앱 내부 navigate 미차단). 지금 useBlocker를 박으면 optional peer 위반·라우터 마이그레이션 강제(거부됨).
- **Decision** — 옵션 객체 API(`UseExitGuardOptions`)를 **전방호환**으로 설계해, 추후 `routerBlocker?` 같은 **선택적 어댑터 콜백**을 깨짐 없이 추가할 수 있게 한다(이번엔 미구현=YAGNI). Data Router 앱이 앱 내부 네비까지 막아야 하면 그 앱이 어댑터를 주입하거나 자체 useBlocker를 병행.
- **Alternatives** — 지금 하이브리드 어댑터 구현 → 거부(현재 그걸 요구하는 앱 없음, 복잡도만 증가). 비전방호환 popstate-only 함수 시그니처 → 거부(나중에 breaking change 필요).
- **Consequences** — 슬라이스 0 표면적은 최소로 유지하되, 미래 확장이 non-breaking. 앱 내부 네비 차단은 **이 공유 훅의 범위 밖**임을 아래 Out of Scope에 명시.

## 미결 사항 (Codex 검토 전 확인)
1. **Phase 4 구현 경로** — `teachermate-shared`는 AO config(`scripts/ao/config.yaml`)에 **미등록**. 슬라이스 0은 시각 산출물 없는 ~60줄 훅+단위테스트라 AO Generator/Eval-Visual/Eval-Interaction 매트릭스 부적합. → **(a) AO에 teachermate-shared 등록 후 진행 vs (b) 새 세션 master가 직접 구현(codex review diff + `npm test`/`tsc`)**. Plan/SDD/Preflight(codex 검토)는 동일하게 수행, Phase 4만 분기. **추천 = (b)** — 비시각·소규모·단위테스트 검증이 본질에 맞음. Phase 4에서 jery 확인.
2. ~~sentinel cleanup 정확성~~ — **해소(R1)**: ADR-1 부속 "sentinel 생명주기 계약" + 테스트 매트릭스로 슬라이스 0 Plan/AC에 확정. SDD §3은 이를 grep 가능 Sprint Contract로 옮겨 적음.
3. **ExitGuardModal 신설 여부** — 옵션 컴포넌트를 이번에 포함할지, 훅만 내고 모달은 슬라이스 1에서 앱별로 ConfirmModal 직접 쓸지. 추천 = 이번에 포함(보일러플레이트 절감, 카피 일관성).

## 범위 경계 — useExitGuard가 막는 것 / 안 막는 것 (codex R1 [medium] 반영)
- ✅ **막음**: 브라우저 뒤로가기 버튼, 모바일 하드웨어 뒤로가기, (보조) 탭 닫기/새로고침(useBeforeUnload).
- ❌ **안 막음**: 앱 **내부** SPA 네비게이션 — `<Link>`, `navigate()`, 헤더/네비 링크, 프로그램적 redirect, 앱별 커스텀 이동 컨트롤. 이는 popstate를 발생시키지 않으므로 본 훅 범위 밖.
- → **BackToSessions는 "공유 나가기 버튼" 1개 경로만 confirm**을 담당하며, 임의의 Link/navigate를 포괄하지 않는다(codex 지적 수용). 따라서 **슬라이스 1 각 앱 적용 시, 그 앱의 모든 내부 이탈 경로(Link/navigate/header/redirect)를 인벤토리**하고 데이터 유실 위험이 있는 곳은 BackToSessions-동급 confirm 또는 (Data Router면) useBlocker로 별도 커버하는 것을 **슬라이스 1 AC에 포함**한다. 이 인벤토리·커버는 슬라이스 0 범위 밖(아래).

## Out of Scope (이번에 안 하는 것)
- 앱 코드 수정 일체 (슬라이스 1: 가드 전무 7앱 적용 / 슬라이스 2: 교사 네비 / 슬라이스 3: 복귀 링크) — **전부 후속 슬라이스**.
- **앱 내부 SPA 네비게이션(Link/navigate/redirect) 차단** — 본 공유 훅의 범위 아님(위 "범위 경계"). 필요한 앱은 슬라이스 1에서 자체 처리.
- **Data Router용 router 어댑터 실구현** — ADR-4의 전방호환 자리만 남기고 미구현(YAGNI).
- **각 앱 내부 이탈경로 인벤토리/커버** — 슬라이스 1 각 앱 PR의 AC(슬라이스 0은 contract만 제공).
- 4개 비소비 앱(data-class·kospi·vibe·sangkwon)에 `@teachermate/shared` dep 추가 — 슬라이스 1에서 앱별 수행.
- `useBeforeUnload`/`BackToSessions`/`DirtyGuardProvider` 기존 동작 변경 — 재사용만, 시그니처 불변.
- verify-route-policy 스킬에 §9.H-18/19 검사 추가 — 별도 부수 작업(에픽 후반).
- service-nav / 교사 네비 관련 일체(이건 §9.H-19, 별도 슬라이스 2).

## 에픽 구조 (전체 맥락 — 이번 PR은 슬라이스 0만)
| 슬라이스 | 레포 | 내용 | 의존 |
|---------|------|------|------|
| **0 (이번)** | teachermate-shared | `useExitGuard` + ExitGuardModal + export + test + v0.14.0 | — |
| 1 | 7앱 각각 | 뒤로가기 가드 적용(전무 6앱 + beforeunload→승격). 비소비 4앱은 dep 추가 선행 | 0 머지·published |
| 2 | data-class 등 | 교사 공통 네비 복구(§9.H-19) — **별개 정책, useExitGuard 무관** | — |
| 3 | 다수 | 복귀 링크(← 수업 목록/나가기) 보강 | 0(BackToSessions) |
> 슬라이스 1~3은 각각 **독립 레포 PR**이므로 별도 blueprint/AO 런으로 진행(jery 결정: 슬라이스 0 먼저 단독). Stacked PR 없음 — 슬라이스 0 머지 후 각 앱이 `npm install`로 `#main` 갱신.
