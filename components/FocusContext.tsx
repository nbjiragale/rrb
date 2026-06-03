"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface FocusContextValue {
  active: boolean;
  acquire: () => void;
  release: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

// Ref-counted so multiple/nested surfaces can request focus and chrome only
// returns once every requester has released (UIredesignspec §5.1).
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const acquire = useCallback(() => setCount((c) => c + 1), []);
  const release = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const value = useMemo<FocusContextValue>(
    () => ({ active: count > 0, acquire, release }),
    [count, acquire, release]
  );
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

/** True while any surface has requested focus mode. Read by the AppShell. */
export function useFocusActive(): boolean {
  return useContext(FocusContext)?.active ?? false;
}

// Hook for a surface that wants the app chrome hidden while it is mounted/active
// (e.g. the mock runner). acquire/release are stable, so this fires once on
// mount and releases on unmount — no re-acquire loop.
export function useFocusMode(active = true): void {
  const ctx = useContext(FocusContext);
  const acquire = ctx?.acquire;
  const release = ctx?.release;
  useEffect(() => {
    if (!active || !acquire || !release) return;
    acquire();
    return release;
  }, [active, acquire, release]);
}
