import { ConfirmModal } from './ConfirmModal';
import type { UseExitGuardReturn } from '../hooks/useExitGuard';

export type ExitGuardAudience = 'teacher' | 'student';

const COPY: Record<ExitGuardAudience, { title: string; description: string }> = {
  teacher: {
    title: '수업 목록으로 나가시겠어요?',
    description: '저장하지 않은 변경사항이 있습니다. 정말 나가시겠어요?',
  },
  student: {
    title: '수업에서 나가시겠어요?',
    description: '저장하지 않은 변경사항이 있습니다. 정말 나가시겠어요?',
  },
};

export interface ExitGuardModalProps {
  /** useExitGuard 반환값에서 가져오는 모달 상태/액션. */
  promptOpen: boolean;
  confirmExit: () => void;
  cancelExit: () => void;
  /** 카피 톤(기본 student). BackToSessions 카피와 동일 계열. */
  audience?: ExitGuardAudience;
  /** 본문 override(useExitGuard message와 동일 용도). */
  message?: string;
}

/**
 * ExitGuardModal — useExitGuard 전용 확인 모달(옵션 companion).
 * 신규 모달을 만들지 않고 §9.H-4 계약 구현체 ConfirmModal을 재사용한다.
 * 앱은 `const guard = useExitGuard({when, onConfirmExit}); <ExitGuardModal {...guard} />` 형태로 사용.
 */
export function ExitGuardModal({
  promptOpen,
  confirmExit,
  cancelExit,
  audience = 'student',
  message,
}: ExitGuardModalProps) {
  const copy = COPY[audience];
  return (
    <ConfirmModal
      open={promptOpen}
      onClose={cancelExit}
      onConfirm={confirmExit}
      title={copy.title}
      description={message ?? copy.description}
      confirmLabel="나가기"
      cancelLabel="취소"
      variant="destructive"
    />
  );
}

/** 편의용 — useExitGuard 반환 전체를 그대로 spread해서 넘길 수 있도록 한 형태. */
export type ExitGuardModalGuardProps = UseExitGuardReturn;
