import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useBeforeUnload } from '../hooks/useBeforeUnload';

export interface DirtyGuardValue {
  isDirty: boolean;
  markDirty: (delta: number) => void;
  reset: () => void;
}

export interface DirtyGuardProviderProps {
  threshold?: number;
  children: ReactNode;
}

const DirtyGuardContext = createContext<DirtyGuardValue | null>(null);

export function DirtyGuardProvider({ threshold = 50, children }: DirtyGuardProviderProps) {
  const [isDirty, setIsDirty] = useState(false);
  useBeforeUnload(isDirty);
  const value = useMemo<DirtyGuardValue>(
    () => ({
      isDirty,
      markDirty: (delta: number) => {
        if (delta >= threshold) setIsDirty(true);
      },
      reset: () => setIsDirty(false),
    }),
    [isDirty, threshold],
  );
  return <DirtyGuardContext.Provider value={value}>{children}</DirtyGuardContext.Provider>;
}

export function useDirtyGuardContext(): DirtyGuardValue {
  const ctx = useContext(DirtyGuardContext);
  if (!ctx) throw new Error('useDirtyGuardContext must be used within <DirtyGuardProvider>');
  return ctx;
}
