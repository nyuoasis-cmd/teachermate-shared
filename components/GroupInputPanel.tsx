import { useMemo, useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmModal, formatRelativeTime, showToast } from '../index';

export type GroupInputMode = 'consensus' | 'leader-only';

export interface GroupProposal<T> {
  id: string;
  proposerId: string;
  proposerNickname: string;
  value: T;
  createdAt: Date;
  isConfirmed: boolean;
}

export interface GroupInputPanelProps<T> {
  mode: GroupInputMode;
  sessionId: string;
  groupId: string;
  fieldName: string;
  fieldLabel: string;
  currentUserId: string;
  currentUserNickname: string;
  isLeader: boolean;
  confirmedValue: T | null;
  confirmedBy?: { id: string; nickname: string; at: Date } | null;
  renderEditor: (value: T | null, onChange: (value: T) => void) => ReactNode;
  renderValue: (value: T) => ReactNode;
  onPropose?: (value: T) => Promise<void>;
  onConfirmProposal?: (proposalId: string) => Promise<void>;
  onLeaderEdit?: (value: T) => Promise<void>;
  onProposalDelete?: (proposalId: string) => Promise<void>;
  proposals: GroupProposal<T>[];
  loading?: boolean;
  emptyProposalMessage?: string;
}

function EmptyValueCard({ fieldLabel }: { fieldLabel: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-4 text-sm text-stone-500 [word-break:keep-all]">
      아직 확정된 {fieldLabel}이 없어요.
    </div>
  );
}

export function GroupInputPanel<T>({
  mode,
  fieldLabel,
  currentUserId,
  currentUserNickname,
  isLeader,
  confirmedValue,
  confirmedBy = null,
  renderEditor,
  renderValue,
  onPropose,
  onConfirmProposal,
  onLeaderEdit,
  onProposalDelete,
  proposals,
  loading = false,
  emptyProposalMessage = '아직 의견이 없어요. 첫 의견을 내볼까요?',
}: GroupInputPanelProps<T>) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<T | null>(null);
  const [proposalToConfirm, setProposalToConfirm] = useState<GroupProposal<T> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sortedProposals = useMemo(
    () =>
      [...proposals]
        .filter((proposal) => !proposal.isConfirmed)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    [proposals],
  );

  const resetEditor = () => {
    setDraftValue(null);
    setIsEditorOpen(false);
    setIsSaving(false);
  };

  const submitProposal = async () => {
    if (!onPropose || draftValue === null || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await onPropose(draftValue);
      resetEditor();
    } finally {
      setIsSaving(false);
    }
  };

  const submitLeaderEdit = async () => {
    if (!onLeaderEdit || draftValue === null || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await onLeaderEdit(draftValue);
      resetEditor();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSelectedProposal = async () => {
    if (!proposalToConfirm || !onConfirmProposal) {
      return;
    }

    await onConfirmProposal(proposalToConfirm.id);
    showToast(`${proposalToConfirm.proposerNickname}의 의견으로 확정했어요`, 'success');
    setProposalToConfirm(null);
  };

  const readonlyBannerText = confirmedBy?.at
    ? `모둠장이 입력 중 · ${formatRelativeTime(confirmedBy.at, { mode: 'past-only' })}`
    : '모둠장이 입력 중 · 방금';

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-500">{fieldLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-900">현재 아이디어</h3>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        {confirmedValue !== null ? renderValue(confirmedValue) : <EmptyValueCard fieldLabel={fieldLabel} />}

        {mode === 'consensus' ? (
          confirmedBy ? (
            <p className="mt-3 text-sm text-stone-500 [word-break:keep-all]">
              {confirmedBy.nickname} 이 확정 · {formatRelativeTime(confirmedBy.at, { mode: 'past-only' })}
            </p>
          ) : null
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-stone-500 [word-break:keep-all]">{readonlyBannerText}</p>
            {isLeader && !isEditorOpen ? (
              <button
                type="button"
                onClick={() => {
                  setDraftValue(confirmedValue);
                  setIsEditorOpen(true);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              >
                <Pencil className="h-4 w-4" />
                수정하기
              </button>
            ) : null}
          </div>
        )}
      </div>

      {mode === 'leader-only' ? (
        <>
          {!isLeader ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 [word-break:keep-all]">
              조원은 모둠장의 입력을 실시간으로 볼 수 있어요.
            </div>
          ) : null}

          {isLeader && isEditorOpen ? (
            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              {renderEditor(draftValue, setDraftValue)}
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={resetEditor}
                  className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 transition hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={draftValue === null || isSaving}
                  onClick={() => {
                    void submitLeaderEdit();
                  }}
                  className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? '저장 중' : '저장하기'}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-700">의견 {sortedProposals.length}개</p>
          </div>

          {loading ? <p className="mt-4 text-sm text-stone-500">의견을 불러오는 중이에요.</p> : null}

          {!loading && sortedProposals.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
              <p className="text-sm text-stone-500 [word-break:keep-all]">{emptyProposalMessage}</p>
              <div className="mt-4">{renderEditor(draftValue, setDraftValue)}</div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  disabled={draftValue === null || isSaving}
                  onClick={() => {
                    void submitProposal();
                  }}
                  className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? '등록 중' : '의견 올리기'}
                </button>
              </div>
            </div>
          ) : null}

          {!loading && sortedProposals.length > 0 ? (
            <div className="mt-4 space-y-3">
              {sortedProposals.map((proposal) => (
                <article key={proposal.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-stone-700">
                      {proposal.proposerNickname} · {formatRelativeTime(proposal.createdAt, { mode: 'past-only' })}
                    </p>
                  </div>
                  <div className="mt-3 text-stone-900 [word-break:keep-all]">{renderValue(proposal.value)}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isLeader ? (
                      <button
                        type="button"
                        onClick={() => setProposalToConfirm(proposal)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
                      >
                        <Check className="h-4 w-4" />
                        이걸로 하기
                      </button>
                    ) : null}
                    {proposal.proposerId === currentUserId ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onProposalDelete) {
                            void onProposalDelete(proposal.id);
                          }
                        }}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {sortedProposals.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
              {isEditorOpen ? (
                <>
                  {renderEditor(draftValue, setDraftValue)}
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={resetEditor}
                      className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 transition hover:bg-stone-100"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={draftValue === null || isSaving}
                      onClick={() => {
                        void submitProposal();
                      }}
                      className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? '등록 중' : '의견 올리기'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraftValue(null);
                    setIsEditorOpen(true);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  <Plus className="h-4 w-4" />
                  + 내 의견 추가하기
                </button>
              )}
            </div>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={proposalToConfirm !== null}
        onClose={() => setProposalToConfirm(null)}
        onConfirm={confirmSelectedProposal}
        title="이 의견으로 확정할까요?"
        description="이 의견으로 확정할까요? 확정 후에도 바꿀 수 있어요."
        confirmLabel="확정하기"
        cancelLabel="취소"
        variant="primary"
      />
    </section>
  );
}
