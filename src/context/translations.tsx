import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth';
import { Lang, langByCode, translateBatch, TranslateItem } from '../lib/translate';

/**
 * Auto-translation engine. Any `<T>` on screen registers the text it wants in
 * the reader's language; the provider debounces and batches those into one
 * Edge-Function call, caches the results in memory, and re-renders consumers
 * when translations arrive. The original text always renders immediately, so
 * there's never a blank flash.
 */

type Item = TranslateItem;
const baseKey = (i: { source: string; id: string; field: string }) => `${i.source}:${i.id}:${i.field}`;

interface Ctx {
  lang: Lang | null; // active target (null when reader is on English)
  version: number; // bumps when new translations land → re-renders consumers
  get: (key: string, original: string) => string | undefined;
  request: (item: Item) => void;
}

const TranslationContext = createContext<Ctx | null>(null);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const lang = useMemo(() => {
    const l = langByCode(profile?.preferred_lang);
    return l && l.code !== 'en' ? l : null;
  }, [profile?.preferred_lang]);

  const [version, setVersion] = useState(0);

  // memory cache: codeKey → { original, value }
  const cache = useRef(new Map<string, { original: string; value: string }>());
  const pending = useRef(new Map<string, Item>()); // codeKey → item
  const inFlight = useRef(new Set<string>());
  const attempted = useRef(new Map<string, string>()); // codeKey → original text we already tried
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const codeKey = useCallback((key: string) => `${key}::${lang?.code ?? 'en'}`, [lang]);

  const flush = useCallback(async () => {
    timer.current = null;
    const active = lang;
    if (!active) return;
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    batch.forEach(([ck]) => inFlight.current.add(ck));

    const items = batch.map(([, it]) => it);
    const map = await translateBatch(active.name, items);

    let changed = false;
    batch.forEach(([ck, it]) => {
      inFlight.current.delete(ck);
      attempted.current.set(ck, it.text); // don't keep retrying a given text+lang
      const t = map[baseKey(it)];
      if (t) {
        cache.current.set(ck, { original: it.text, value: t });
        changed = true;
      }
    });
    if (changed) setVersion((v) => v + 1);
  }, [lang]);

  const request = useCallback((item: Item) => {
    if (!lang) return;
    const ck = codeKey(baseKey(item));
    if (inFlight.current.has(ck) || pending.current.has(ck)) return;
    const hit = cache.current.get(ck);
    if (hit && hit.original === item.text) return;
    if (attempted.current.get(ck) === item.text) return; // already tried this exact text
    pending.current.set(ck, item);
    if (!timer.current) timer.current = setTimeout(flush, 80);
  }, [lang, codeKey, flush]);

  const get = useCallback((key: string, original: string): string | undefined => {
    const hit = cache.current.get(codeKey(key));
    return hit && hit.original === original ? hit.value : undefined;
  }, [codeKey]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo<Ctx>(() => ({ lang, version, get, request }), [lang, version, get, request]);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export interface TranslatedState {
  display: string;
  translated: boolean;
  loading: boolean;
}

/** Returns the reader's-language text for an item (or the original meanwhile). */
export function useTranslated(item: { source: string; id: string; field: string; text: string | null | undefined }): TranslatedState {
  const ctx = useContext(TranslationContext);
  const text = (item.text ?? '').toString();
  const enabled = !!ctx?.lang && !!text.trim();
  const key = baseKey(item);
  const value = enabled ? ctx!.get(key, text) : undefined;

  useEffect(() => {
    if (enabled && value === undefined) ctx!.request({ source: item.source, id: item.id, field: item.field, text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, text, value, ctx?.version]);

  return { display: value ?? text, translated: enabled && value !== undefined, loading: enabled && value === undefined };
}

/** Whether auto-translation is active for this reader (used to show toggles). */
export function useTranslationActive(): boolean {
  return !!useContext(TranslationContext)?.lang;
}
