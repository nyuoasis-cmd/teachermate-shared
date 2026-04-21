import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { GroupInputMode, GroupProposal } from '../components/GroupInputPanel';

type GroupInputAction = 'propose' | 'confirm' | 'leader-edit' | 'delete';

interface GroupProposalRow<T> {
  id: string;
  proposer_id: string;
  proposer_nickname: string;
  proposed_value: T;
  created_at: string;
  is_confirmed: boolean;
  confirmed_at: string | null;
  confirmed_by: string | null;
  deleted_at: string | null;
}

export interface UseGroupInputOptions<T> {
  supabase: SupabaseClient;
  sessionId: string;
  groupId: string;
  fieldName: string;
  currentUserId: string;
  mode: GroupInputMode;
  onError?: (error: Error, action: GroupInputAction) => void;
}

export interface UseGroupInputReturn<T> {
  confirmedValue: T | null;
  confirmedBy: { id: string; nickname: string; at: Date } | null;
  proposals: GroupProposal<T>[];
  loading: boolean;
  propose: (value: T) => Promise<void>;
  confirmProposal: (proposalId: string) => Promise<void>;
  leaderEdit: (value: T) => Promise<void>;
  deleteProposal: (proposalId: string) => Promise<void>;
}

function normalizeError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function mapProposalRow<T>(row: GroupProposalRow<T>): GroupProposal<T> {
  return {
    id: row.id,
    proposerId: row.proposer_id,
    proposerNickname: row.proposer_nickname,
    value: row.proposed_value,
    createdAt: new Date(row.created_at),
    isConfirmed: row.is_confirmed,
  };
}

function buildConfirmedBy<T>(row: GroupProposalRow<T> | null) {
  if (!row?.confirmed_at) {
    return null;
  }

  const nickname = row.confirmed_by && row.confirmed_by !== row.proposer_id ? '모둠장' : row.proposer_nickname;
  return {
    id: row.confirmed_by ?? row.proposer_id,
    nickname,
    at: new Date(row.confirmed_at),
  };
}

export function useGroupInput<T>({
  supabase,
  sessionId,
  groupId,
  fieldName,
  currentUserId,
  mode,
  onError,
}: UseGroupInputOptions<T>): UseGroupInputReturn<T> {
  const [confirmedValue, setConfirmedValue] = useState<T | null>(null);
  const [confirmedBy, setConfirmedBy] = useState<{ id: string; nickname: string; at: Date } | null>(null);
  const [proposals, setProposals] = useState<GroupProposal<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingIntervalRef = useRef<number | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const nicknameRef = useRef<string | null>(null);

  const handleError = useCallback(
    (error: unknown, action: GroupInputAction) => {
      const normalized = normalizeError(error, '모둠 입력 처리 중 오류가 발생했어요.');
      onError?.(normalized, action);
      return normalized;
    },
    [onError],
  );

  const syncRowsToState = useCallback((rows: GroupProposalRow<T>[]) => {
    const activeRows = rows.filter((row) => row.deleted_at === null);
    const confirmedRow = activeRows.find((row) => row.is_confirmed) ?? null;
    const nextProposals = activeRows
      .filter((row) => !row.is_confirmed)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map(mapProposalRow);

    setConfirmedValue(confirmedRow ? confirmedRow.proposed_value : null);
    setConfirmedBy(buildConfirmedBy(confirmedRow));
    setProposals(nextProposals);
  }, []);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('group_proposals')
      .select(
        'id, proposer_id, proposer_nickname, proposed_value, created_at, is_confirmed, confirmed_at, confirmed_by, deleted_at',
      )
      .eq('session_id', sessionId)
      .eq('group_id', groupId)
      .eq('field_name', fieldName)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    syncRowsToState((data ?? []) as GroupProposalRow<T>[]);
  }, [fieldName, groupId, sessionId, supabase, syncRowsToState]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      return;
    }

    pollingIntervalRef.current = window.setInterval(() => {
      void fetchRows().catch((error) => {
        handleError(error, 'propose');
      });
    }, 10000);
  }, [fetchRows, handleError]);

  const resolveNickname = useCallback(async () => {
    if (nicknameRef.current) {
      return nicknameRef.current;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }

    const metadata = data.user?.user_metadata as Record<string, unknown> | undefined;
    const resolved =
      typeof metadata?.nickname === 'string'
        ? metadata.nickname
        : typeof metadata?.name === 'string'
          ? metadata.name
          : typeof metadata?.full_name === 'string'
            ? metadata.full_name
            : data.user?.email?.split('@')[0] ?? currentUserId.slice(0, 6);

    nicknameRef.current = resolved;
    return resolved;
  }, [currentUserId, supabase]);

  useEffect(() => {
    setLoading(true);

    void fetchRows()
      .catch((error) => {
        handleError(error, 'propose');
      })
      .finally(() => {
        setLoading(false);
      });

    const channel = supabase
      .channel(`shared-group-input:${sessionId}:${groupId}:${fieldName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_proposals',
          filter: `session_id=eq.${sessionId},group_id=eq.${groupId},field_name=eq.${fieldName}`,
        },
        () => {
          void fetchRows().catch((error) => {
            handleError(error, 'propose');
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_proposals',
          filter: `session_id=eq.${sessionId},group_id=eq.${groupId},field_name=eq.${fieldName}`,
        },
        () => {
          void fetchRows().catch((error) => {
            handleError(error, 'propose');
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_proposals',
          filter: `session_id=eq.${sessionId},group_id=eq.${groupId},field_name=eq.${fieldName}`,
        },
        () => {
          void fetchRows().catch((error) => {
            handleError(error, 'propose');
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          stopPolling();
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling();
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      stopPolling();
      if (realtimeChannelRef.current) {
        void supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchRows, fieldName, groupId, handleError, sessionId, startPolling, stopPolling, supabase]);

  const propose = useCallback(
    async (value: T) => {
      const nickname = await resolveNickname();
      const tempId = `temp-${Date.now()}`;
      const optimistic: GroupProposal<T> = {
        id: tempId,
        proposerId: currentUserId,
        proposerNickname: nickname,
        value,
        createdAt: new Date(),
        isConfirmed: false,
      };

      setProposals((current) => [optimistic, ...current]);

      try {
        const { data, error } = await supabase
          .from('group_proposals')
          .insert({
            session_id: sessionId,
            group_id: groupId,
            field_name: fieldName,
            proposer_id: currentUserId,
            proposer_nickname: nickname,
            proposed_value: value,
            is_confirmed: false,
          })
          .select(
            'id, proposer_id, proposer_nickname, proposed_value, created_at, is_confirmed, confirmed_at, confirmed_by, deleted_at',
          )
          .single();

        if (error) {
          throw error;
        }

        setProposals((current) => {
          const withoutTemp = current.filter((proposal) => proposal.id !== tempId);
          const next = [mapProposalRow(data as GroupProposalRow<T>), ...withoutTemp];
          return next.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        });
      } catch (error) {
        setProposals((current) => current.filter((proposal) => proposal.id !== tempId));
        throw handleError(error, 'propose');
      }
    },
    [currentUserId, fieldName, groupId, handleError, resolveNickname, sessionId, supabase],
  );

  const confirmProposal = useCallback(
    async (proposalId: string) => {
      try {
        const { data: existingConfirmed, error: existingConfirmedError } = await supabase
          .from('group_proposals')
          .select(
            'id, proposer_id, proposer_nickname, proposed_value, created_at, is_confirmed, confirmed_at, confirmed_by, deleted_at',
          )
          .eq('session_id', sessionId)
          .eq('group_id', groupId)
          .eq('field_name', fieldName)
          .eq('is_confirmed', true)
          .is('deleted_at', null);

        if (existingConfirmedError) {
          throw existingConfirmedError;
        }

        const previousConfirmedRows = (existingConfirmed ?? []) as GroupProposalRow<T>[];

        if (previousConfirmedRows.length > 0) {
          const { error: clearError } = await supabase
            .from('group_proposals')
            .update({
              is_confirmed: false,
              confirmed_at: null,
              confirmed_by: null,
            })
            .eq('session_id', sessionId)
            .eq('group_id', groupId)
            .eq('field_name', fieldName)
            .eq('is_confirmed', true)
            .is('deleted_at', null);

          if (clearError) {
            throw clearError;
          }
        }

        const confirmedAt = new Date().toISOString();
        const { error: confirmError } = await supabase
          .from('group_proposals')
          .update({
            is_confirmed: true,
            confirmed_at: confirmedAt,
            confirmed_by: currentUserId,
          })
          .eq('id', proposalId)
          .eq('session_id', sessionId)
          .eq('group_id', groupId)
          .eq('field_name', fieldName);

        if (confirmError) {
          if (previousConfirmedRows.length > 0) {
            for (const row of previousConfirmedRows) {
              await supabase
                .from('group_proposals')
                .update({
                  is_confirmed: true,
                  confirmed_at: row.confirmed_at,
                  confirmed_by: row.confirmed_by,
                })
                .eq('id', row.id);
            }
          }

          throw confirmError;
        }

        await fetchRows();
      } catch (error) {
        throw handleError(error, 'confirm');
      }
    },
    [currentUserId, fetchRows, fieldName, groupId, handleError, sessionId, supabase],
  );

  const leaderEdit = useCallback(
    async (value: T) => {
      try {
        const nickname = await resolveNickname();
        const confirmedAt = new Date().toISOString();
        const { data: existing, error: existingError } = await supabase
          .from('group_proposals')
          .select('id')
          .eq('session_id', sessionId)
          .eq('group_id', groupId)
          .eq('field_name', fieldName)
          .eq('is_confirmed', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existing?.id) {
          const { error } = await supabase
            .from('group_proposals')
            .update({
              proposer_id: currentUserId,
              proposer_nickname: nickname,
              proposed_value: value,
              confirmed_at: confirmedAt,
              confirmed_by: currentUserId,
              is_confirmed: true,
            })
            .eq('id', existing.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase.from('group_proposals').insert({
            session_id: sessionId,
            group_id: groupId,
            field_name: fieldName,
            proposer_id: currentUserId,
            proposer_nickname: nickname,
            proposed_value: value,
            is_confirmed: true,
            confirmed_at: confirmedAt,
            confirmed_by: currentUserId,
          });

          if (error) {
            throw error;
          }
        }

        await fetchRows();
      } catch (error) {
        throw handleError(error, 'leader-edit');
      }
    },
    [currentUserId, fetchRows, fieldName, groupId, handleError, resolveNickname, sessionId, supabase],
  );

  const deleteProposal = useCallback(
    async (proposalId: string) => {
      const previousProposals = proposals;
      setProposals((current) => current.filter((proposal) => proposal.id !== proposalId));

      try {
        const { error } = await supabase
          .from('group_proposals')
          .delete()
          .eq('id', proposalId)
          .eq('session_id', sessionId)
          .eq('group_id', groupId)
          .eq('field_name', fieldName);

        if (error) {
          throw error;
        }
      } catch (error) {
        setProposals(previousProposals);
        throw handleError(error, 'delete');
      }
    },
    [fieldName, groupId, handleError, proposals, sessionId, supabase],
  );

  return useMemo(
    () => ({
      confirmedValue,
      confirmedBy,
      proposals: mode === 'consensus' ? proposals : [],
      loading,
      propose,
      confirmProposal,
      leaderEdit,
      deleteProposal,
    }),
    [confirmedBy, confirmedValue, confirmProposal, deleteProposal, leaderEdit, loading, mode, proposals, propose],
  );
}
