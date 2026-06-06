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
- **Consequences** — 장점: 라우터 무관, 검증된 패턴, 단위 테스트 용이, 후속 슬라이스 변경 최소. 단점: ① 앱 내부 `<Link>` 네비게이션은 막지 않음(→ BackToSessions가 담당, 역할 분담으로 해소). ② history에 sentinel entry를 쌓으므로 cleanup(가드 비활성/언마운트 시 pushState 보정)을 정확히 해야 "뒤로가기 두 번 눌러야 나가짐" 같은 누수 방지 필요. SDD §3에서 cleanup 계약을 grep 가능 기준으로 명시.

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

## 미결 사항 (Codex 검토 전 확인)
1. **Phase 4 구현 경로** — `teachermate-shared`는 AO config(`scripts/ao/config.yaml`)에 **미등록**. 슬라이스 0은 시각 산출물 없는 ~60줄 훅+단위테스트라 AO Generator/Eval-Visual/Eval-Interaction 매트릭스 부적합. → **(a) AO에 teachermate-shared 등록 후 진행 vs (b) 새 세션 master가 직접 구현(codex review diff + `npm test`/`tsc`)**. Plan/SDD/Preflight(codex 검토)는 동일하게 수행, Phase 4만 분기. **추천 = (b)** — 비시각·소규모·단위테스트 검증이 본질에 맞음. Phase 4에서 jery 확인.
2. **sentinel cleanup 정확성** — 가드 활성↔비활성 전환, 모달 취소 후 재push, 언마운트 시 history 보정 로직. SDD §3에서 명세.
3. **ExitGuardModal 신설 여부** — 옵션 컴포넌트를 이번에 포함할지, 훅만 내고 모달은 슬라이스 1에서 앱별로 ConfirmModal 직접 쓸지. 추천 = 이번에 포함(보일러플레이트 절감, 카피 일관성).

## Out of Scope (이번에 안 하는 것)
- 앱 코드 수정 일체 (슬라이스 1: 가드 전무 7앱 적용 / 슬라이스 2: 교사 네비 / 슬라이스 3: 복귀 링크) — **전부 후속 슬라이스**.
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
