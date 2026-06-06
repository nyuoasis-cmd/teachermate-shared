# Codex Evidence — useExitGuard 슬라이스 0 (blueprint Phase 1 Plan + Phase 2 SDD)

검토 도구: `codex adversarial-review --wait --base main` (openai-codex 1.0.4 companion). 검토 대상 = 커밋된 branch diff(feat/useexitguard).

## Phase 1 (Plan) — 라운드별 verdict 추이
| R | verdict | 핵심 issue → 반영 |
|---|---------|------------------|
| R1 | needs-attention | sentinel 생명주기를 SDD로 미루지 말고 Plan/AC로 승격 / SPA 내부 네비 범위경계 명시 / Data Router 전방호환 확장점 |
| R2 | needs-attention | cleanup의 무조건 history.back()이 내부네비 되돌림 → 소유권(uid) 체크 후에만 back() |
| R3 | needs-attention | 내부 push 후 stale sentinel 스택중간 잔류 → releaseGuard() 도입 + 누수0 정직 한정 |
| R4 | needs-attention | history.back() 비동기 race → releaseAndNavigate(navigate) 직렬화(one-shot popstate 후 navigate) |
| R5 | needs-attention | consumer 수동 wrap 의존 취약 → ADR-5 채택안전성+슬라이스1 인벤토리 blocking / popstate 누락 dead-exit → timeout fallback+exactly-once |
| R6 | needs-attention | confirmExit도 동일 back() race 잔존 → serializedRelease(cb) 공용 프리미티브로 통일 |
| R7 | needs-attention | serializedRelease가 가드 disarm 없이 cb 실행→재진입 → terminal disarm(released flag) 후에야 cb |
| R8 | needs-attention | terminal release가 beforeunload 미disarm→이중 네이티브 프롬프트 → useBeforeUnload(when && !released) |
| R9 | needs-attention | beforeunload disarm이 state/effect 타이밍 의존 → 동기 releasedRef 게이팅 / sentinel pushState가 router state 덮어씀 → spread merge+URL 보존 |
| R10 | needs-attention | 일반 disarm/언마운트의 blind back()이 강제 네비 버그 → back은 명시 release만, bounded stale 수용 / sentinel 충돌경계 |
| R11 | needs-attention | non-owner가 owner popstate에 반응해 소유권 뒤집음 → ownsSentinelRef 단일소유자 게이팅, passive no-op / 모순 AC 정정 |
| R12 | needs-attention | non-owner 조용한 passive가 중첩 dirty 가드 무력화(데이터유실) → 라우트당1개 계약+DEV console.error loud 경고 |
| **R13** | **approve** | **No ship-blocking residual. Proceed to Slice 0 implementation.** |

## Phase 1 최종 verdict (R13) — verbatim
```
Target: branch diff against main
Verdict: approve

No ship-blocking residual found in the provided plan diff. The remaining high-risk
areas are explicitly constrained by the slice contract: one active guard per route,
passive as a runtime safety net only, and app-internal navigation inventory deferred
as a blocking Slice 1 acceptance condition.

No material findings.

Next steps:
- Proceed to Slice 0 implementation, but make the one-guard-per-route DEV error and
  passive no-op behavior part of the test matrix, not just documentation.
```
(next-step 반영: passive no-op·DEV 경고 테스트 매트릭스 행 이미 포함.)

## Phase 2 (SDD) — verdict
<!-- Phase 2에서 SDD adversarial-review 결과를 아래 누적 -->
