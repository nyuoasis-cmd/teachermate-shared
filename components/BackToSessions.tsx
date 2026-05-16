import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from './ConfirmModal';
import { useDirtyGuardContext } from './useDirtyGuard';

export type BackToSessionsAudience = 'teacher' | 'student';

export interface BackToSessionsProps {
  audience: BackToSessionsAudience;
}

const COPY: Record<BackToSessionsAudience, { label: string; destination: string; modalTitle: string; modalDescription: string }> = {
  teacher: {
    label: '← 수업 목록',
    destination: '/dashboard',
    modalTitle: '수업 목록으로 나가시겠어요?',
    modalDescription: '저장하지 않은 변경사항이 있습니다. 정말 수업 목록으로 나가시겠어요?',
  },
  student: {
    label: '← 수업에서 나가기',
    destination: '/join',
    modalTitle: '수업에서 나가시겠어요?',
    modalDescription: '저장하지 않은 변경사항이 있습니다. 정말 수업에서 나가시겠어요?',
  },
};

export function BackToSessions({ audience }: BackToSessionsProps) {
  const navigate = useNavigate();
  const { isDirty, reset } = useDirtyGuardContext();
  const [modalOpen, setModalOpen] = useState(false);
  const copy = COPY[audience];

  const handleClick = () => {
    if (isDirty) {
      setModalOpen(true);
      return;
    }
    navigate(copy.destination);
  };

  const handleConfirm = () => {
    reset();
    navigate(copy.destination);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex h-9 items-center rounded-lg border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-700 transition hover:bg-stone-50"
      >
        {copy.label}
      </button>
      <ConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        title={copy.modalTitle}
        description={copy.modalDescription}
        confirmLabel="나가기"
        cancelLabel="취소"
        variant="destructive"
      />
    </>
  );
}
