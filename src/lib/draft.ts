import { useCallback, useRef, useState } from 'react';

/**
 * Tiny in-memory draft store so half-typed forms and chat messages survive
 * navigating away from a screen and back (Expo Router remounts the screen, so
 * plain useState is lost). Drafts live for the session; cleared on submit/send
 * or app reload. Keyed strings should be unique per form/thread.
 */
const store = new Map<string, unknown>();

/** Like useState, but the value persists in the session draft store under `key`. */
export function useDraft<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  const set = useCallback((v: T) => { store.set(key, v); setVal(v); }, [key]);
  return [val, set];
}

/** A one-shot snapshot of a multi-field form draft (read once in a useState initializer). */
export function getDraft<T = Record<string, unknown>>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}
export function setDraft(key: string, value: unknown): void {
  store.set(key, value);
}
export function clearDraft(key: string): void {
  store.delete(key);
}
