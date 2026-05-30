"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Survives tab switches and refresh (default for App Router page navigation
// re-mounts components and wipes useState). Single-user app, so no need for
// cross-tab sync via the `storage` event.
//
// Usage:
//   const [messages, setMessages] = useLocalStorage<Msg[]>(`tutor:chat:${id}`, []);
//
// SSR-safe: starts with `initial`, hydrates from storage in an effect to avoid
// hydration mismatch.
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);
  const keyRef = useRef(key);

  // Re-hydrate when the key changes (e.g. conceptId switches).
  useEffect(() => {
    keyRef.current = key;
    hydratedRef.current = false;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
      else setValue(initial);
    } catch {
      setValue(initial);
    } finally {
      hydratedRef.current = true;
    }
    // initial intentionally excluded — reference may change each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist on every change, but only after first hydrate so we don't overwrite
  // stored data with the SSR-initial on first mount.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // quota exceeded / serialization failure — fail silent, in-memory state still works.
    }
  }, [value]);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(keyRef.current);
    } catch {
      // ignore
    }
    setValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [value, setValue, reset];
}
