import { ConfirmModal } from './ConfirmModal';
import type { UseExitGuardReturn } from '../hooks/useExitGuard';

export type ExitGuardAudience = 'teacher' | 'student';

const COPY: Record<ExitGuardAudience, { title: string; description: string }> = {
  teacher: {
    title: '수업 목록으로 나가시겠어요?',
    description: '저장하지 않은 변경사항이 있습니다. 정말 나가시겠어요?',
  },
  student: {
    // §9.H-18 v2.4 — 나가기 확인은 첫 화면에서 «늘» 뜬다. 저장 안 된 입력이 없을 때도 뜨므로 기본 문구가
    // «저장 안 됨» 을 단정하지 않는다. 못 보낸 입력이 있으면 앱이 message 로 §9.H-17 데이터 영향 문구를 넘긴다.
    title: '수업에서 나갈까요?',
    description: '수업 입장 화면으로 돌아가요. 저장된 내용은 그대로 남아요.',
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
      // 🚨 이 창은 뒤로가기가 연 창이다 — 여기서 뒤로가기를 또 가져가면 나가기가 영영 안 된다.
      closeOnBack={false}
    />
  );
}

/** 편의용 — useExitGuard 반환 전체를 그대로 spread해서 넘길 수 있도록 한 형태. */
export type ExitGuardModalGuardProps = UseExitGuardReturn;
