import { useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, ImageIcon } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { showToast } from './ToastContainer';

type SupportedApp = 'meta-character' | 'ar-storybook' | 'ai-music-video';

export interface TrashItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  deletedAt: string;
  daysRemaining: number;
}

export interface TrashListProps {
  appName: SupportedApp;
  teacherId: string;
  fetchEndpoint?: string;
  restoreEndpoint?: string;
  /**
   * 휴지통 목록 fetcher (옵셔널). 호출자가 인증 헤더 등을 포함한 자체 fetch 함수를 주입.
   * 제공되면 fetchEndpoint 무시하고 fetchItems() 결과를 사용.
   */
  fetchItems?: () => Promise<TrashItem[]>;
  /**
   * 복구 액션 함수 (옵셔널). 호출자가 인증 포함 자체 호출을 주입.
   * 제공되면 restoreEndpoint 무시하고 restoreItem(id)를 호출.
   */
  restoreItem?: (id: string) => Promise<void>;
  onRestore?: (id: string) => void;
  emptyMessage?: string;
}

function formatDeletedDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function buildRestoreUrl(template: string, id: string) {
  return template.includes(':id') ? template.replace(':id', id) : `${template.replace(/\/$/, '')}/${id}/restore`;
}

export function TrashList({
  appName,
  teacherId,
  fetchEndpoint = '/api/trash',
  restoreEndpoint = '/api/trash/:id/restore',
  fetchItems,
  restoreItem,
  onRestore,
  emptyMessage = '휴지통이 비어 있습니다',
}: TrashListProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringIds, setRestoringIds] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadItems() {
      try {
        setIsLoading(true);
        let payload: TrashItem[];
        if (fetchItems) {
          payload = await fetchItems();
        } else {
          const params = new URLSearchParams({ appName, teacherId });
          const response = await fetch(`${fetchEndpoint}?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error('휴지통을 불러오지 못했어요');
          }
          payload = (await response.json()) as TrashItem[];
        }
        if (cancelled) return;
        setItems(payload);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setItems([]);
        if (error instanceof Error) {
          console.error(error);
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadItems();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [appName, fetchEndpoint, fetchItems, teacherId]);

  const visibleItems = useMemo(() => items.filter((item) => item.daysRemaining >= 0), [items]);

  const handleRestore = async (item: TrashItem) => {
    if (restoringIds.includes(item.id)) {
      return;
    }

    setRestoringIds((current) => [...current, item.id]);
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));

    try {
      if (restoreItem) {
        await restoreItem(item.id);
      } else {
        const response = await fetch(buildRestoreUrl(restoreEndpoint, item.id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName, teacherId, id: item.id }),
        });
        if (!response.ok) {
          throw new Error('복구하지 못했어요');
        }
      }

      onRestore?.(item.id);
      showToast('복구했어요');
    } catch (error) {
      setItems((current) => (current.some((currentItem) => currentItem.id === item.id) ? current : [...current, item]));
      showToast(error instanceof Error ? error.message : '복구하지 못했어요', 'error');
    } finally {
      setRestoringIds((current) => current.filter((id) => id !== item.id));
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500" style={{ wordBreak: 'keep-all' }}>
        불러오는 중...
      </div>
    );
  }

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white">
        <EmptyState
          context="custom"
          title={emptyMessage}
          description="삭제한 항목이 생기면 여기에서 다시 볼 수 있어요"
          customIcon={ArchiveRestore}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {visibleItems.map((item) => {
        const isRestoring = restoringIds.includes(item.id);
        return (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4"
            style={{ wordBreak: 'keep-all' }}
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-stone-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{item.title}</p>
              <p className="mt-1 text-sm text-stone-500">삭제일 {formatDeletedDate(item.deletedAt)}</p>
              <p className="mt-1 text-sm text-stone-600">남은 복구 기간 {item.daysRemaining}일</p>
            </div>
            <button
              type="button"
              disabled={isRestoring}
              onClick={() => void handleRestore(item)}
              className="h-10 shrink-0 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestoring ? '복구하는 중...' : '복구'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
