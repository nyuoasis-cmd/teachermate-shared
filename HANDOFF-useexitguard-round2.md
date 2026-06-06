# HANDOFF — useExitGuard 슬라이스 0 (Round 2: 구현 완료 → 검토 마무리 + push/PR)

## 현재 상태 (이 세션에서 한 일)
- **구현 완료, 커밋 적재(미push).** branch `feat/useexitguard`, HEAD = `45b5959` (single commit, amend로 누적).
- 만든 파일: `hooks/useExitGuard.ts` · `components/ExitGuardModal.tsx` · `tests/useExitGuard.test.tsx` · `docs/implementation-notes/PR-pending-useexitguard.md`. 수정: `index.ts`(export 추가, 삭제 0) · `package.json`(0.13.0→0.14.0).
- **검증 실측**: `npm run typecheck` EXIT 0 / `npm test` = **12 files, 130 tests passed**(87 baseline 회귀 0 + 신규 43). SC-T1~T24 전부 + 회귀 19종.
- **codex adversarial-review R1~R10 전부 반영**(실호출, verdict 원문 기반). 트레일 전부 `docs/implementation-notes/PR-pending-useexitguard.md`에 누적. 각 라운드 [high]/[medium]을 실 수정 + 회귀 테스트로 닫음:
  - R1: 버전-스큐 덮어쓰기(→window-global 레지스트리) / R2: late-popstate yank(→흡수+URL복원) / R3: throwing cb 누수(→try/finally) / R4: navigate-unmount lifecycle(→흡수 컨트롤러 독립) / R5: 실패 cb 가드 무력화(→restoreOnFailure)+grace 귀속경계 / R6: async reject 복구(→cb 계약 void|Promise<void>) / R7: StrictMode mountedRef / R8: stale 소유권 재arm(→실 마커 재조정) / R9: async 성공 stale yank(→settle 후 intendedHref) / R10: 고정 grace window(→fail-closed DEV경고 + 문서화).

## 🔑 R10 잔여 = master 판단 필요 (round cap 10 도달)
- codex R10 [high] = R5 finding2 재제기(고정 200ms grace 초과 late traversal 미흡수). **codex 권고 #1(정확한 traversal 귀속)은 back()의 popstate를 태깅 불가 → 구현 불가. "무한 유지"는 무관한 popstate 하이재킹(더 나쁜 버그).** → codex 권고 #3(fail-closed + observable)만 채택: fallback 발화 시 DEV `console.warn` + SDD 한계절/노트 명문화.
- **본질: router-agnostic popstate 가드는 native 뒤로가기를 취소·귀속 불가 → grace 초과 극단 지연(jank/BFCache) traversal 완전차단 불가. = Plan ADR-4(router 어댑터 deferred)/ADR-5(bounded) 수용 범위. 정상 환경(<16ms popstate)에선 미발생 edge-of-edge.** master CLAUDE.md "Round 10 초과 시 master 판단으로 비치명 이슈 무시 가능" 적용 대상.

## 새 세션이 할 일 (순서)
1. **이 문서 + `docs/implementation-notes/PR-pending-useexitguard.md` 직접 읽고** 현황 확인(기억 의존 금지). `git log --oneline -1`로 HEAD=`45b5959` 확인, `npm run typecheck` & `npm test` 재실측(EXIT0 / 130 pass).
2. **codex adversarial-review R11 1회 더 실호출**(`node $PLUGIN/scripts/codex-companion.mjs adversarial-review --wait --base main "..."`, PLUGIN=`/home/claude/.claude/plugins/marketplaces/openai-codex/plugins/codex`). 검토대상=커밋된 diff. verdict 원문 인용.
   - **approve** → 4번으로.
   - **needs-attention인데 신규 [high]·치명(데이터유실/누수/계약위반)** → 실 수정 + 회귀 테스트 + 재검토(여전히 round cap 정신: 비치명만 master 무시).
   - **needs-attention인데 R10과 동일 본질한계(grace/router-agnostic)·비치명만** → **master 판단으로 ship**(위 🔑 근거 + ADR-4/5). 날조 금지: verdict 원문 그대로 보고하고 "비치명·본질한계라 수용" 명시.
3. (선택) `/ship` 라이트 체크리스트로 보안 빠른 점검.
4. **push + PR 생성**: `git push -u origin feat/useexitguard` → `gh pr create`.
   - 제목(명시형): `feat(shared): useExitGuard 뒤로가기 가드 공유 훅 + ExitGuardModal (뒤로가기 가드 에픽 1/N, 슬라이스 0)`
   - 본문 필수: **Out of Scope**(앱 적용=슬라이스 1~3 / 4앱 dep 추가 / 내부 이탈경로 인벤토리 / Data Router 어댑터 / 중첩 arbiter) + **GWT AC**(SC-T1~T24 평문) + **한계**(no-remount raw-navigate=Slice1 인벤토리 / grace 초과 late traversal=router-agnostic bounded ADR-4/5) + codex R1~R10 트레일 요약.
5. **jery에게 클릭 가능한 PR URL 제공**(`https://github.com/nyuoasis-cmd/teachermate-shared/pull/<N>` + "클릭→Merge"). **머지 버튼만 jery가 누름.** Stacked PR 없음.

## 절대 규약
- branch=`feat/useexitguard` 고정, 별도 브랜치/PR 무단 생성 금지. 앱 코드 0줄 변경. 기존 useBeforeUnload/BackToSessions/DirtyGuard/ConfirmModal 동작 변경 0(재사용만).
- 단일 진실 소스: `PLAN-useexitguard.md`(ADR-1 부속) · `docs/SDD-useexitguard-v1.md`(SC-1~21, SC-T1~T24).
