# @teachermate/shared

TeacherMate 7개 앱 공용 라이브러리 (React 19 + TypeScript).

## 설치

```json
// package.json
"dependencies": {
  "@teachermate/shared": "github:nyuoasis-cmd/teachermate-shared#main"
}
```

## 포함 (9개 export)

### 유틸
- `lib/relative-time.ts` — 상대시간 포맷팅 (`formatRelativeTime`)

### 컴포넌트
- `components/ConfirmModal.tsx` — 확인 모달
- `components/UndoToast.tsx` + `ToastContainer.tsx` — 삭제 취소 토스트
- `components/EmptyState.tsx` — 빈 상태 UI (Lucide 아이콘)
- `components/QRButton.tsx` — QR 공유 버튼 (Primary 스타일 통일)
- `components/QRFullscreen.tsx` — QR 전체 화면 모달
- `components/GroupInputPanel.tsx` — 모둠 입력 패널 (합의형 B + 대표자형 A)

### 훅
- `hooks/useUndoDelete.ts` — headless undo 삭제 훅 (race-safe)
- `hooks/useGroupInput.ts` — 모둠 입력 헤드리스 훅

---

## Import 예시

```tsx
import {
  ConfirmModal,
  UndoToast,
  ToastContainer,
  showToast,
  EmptyState,
  QRButton,
  QRFullscreen,
  GroupInputPanel,
  useUndoDelete,
  useGroupInput,
  formatRelativeTime,
} from '@teachermate/shared';
```

전체 export 타입은 [`index.ts`](./index.ts) 참조.

---

## 운영 정책

- **peer dependency**: React 18 또는 19
- **React 19** 환경에서 최적화 (기본 타깃)
- 스타일: Tailwind CSS v4 (각 앱의 `@source`에 이 패키지 경로 포함 필수 — destructive 버튼 유틸 누락 방지)

## 관련 문서

- **리팩토링 로드맵**: TeacherMate master repo `shared/REFACTORING-ROADMAP.md` — Wave 1/2/2.7 완료·갭 매트릭스
- **UX 정책**: TeacherMate master repo `shared/BUILDER-UX-POLICY.md` — §4 대시보드 D안, §17 모둠 입력
