# @teachermate/shared

TeacherMate 7개 앱 공용 라이브러리 (React 19 + TypeScript).

## 설치

```json
// package.json
"dependencies": {
  "@teachermate/shared": "github:nyuoasis-cmd/teachermate-shared#main"
}
```

포함

- `lib/relative-time.ts` — 상대시간 포맷팅
- `components/ConfirmModal.tsx` — 확인 모달
- `components/UndoToast.tsx` + `ToastContainer.tsx` — 삭제 취소 토스트
- `components/EmptyState.tsx` — 빈 상태 UI (Lucide 아이콘)
- `hooks/useUndoDelete.ts` — headless undo 삭제 훅

상세 스펙: `teachermate-master` 레포의 `shared/SHARED-COMPONENTS-SPEC.md` 참조.
