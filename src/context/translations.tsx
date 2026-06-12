import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth';
import { Lang, translateBatch, TranslateItem } from '../lib/translate';

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
  // Auto-translation is paused for now (the language feature lives on the
  // feature/i18n-localization branch). Forcing `lang = null` makes every <T>
  // render the original text and stops all translate requests — flip this back
  // to re-enable. (profile is intentionally referenced to keep the dependency.)
  void profile;
  const lang = useMemo<Lang | null>(() => null, []);

  const [version, setVersion] = useState(0);

  // memory cache: codeKey → { original, value }
  const cache = useRef(new Map<string, { original: string; value: string }>());
  const pending = useRef(new Map<string, Item>()); // codeKey → item
  const inFlight = useRef(new Set<string>());
  const attempted = useRef(new Map<string, string>()); // codeKey → original text we already tried
  const fails = useRef(new Map<string, number>()); // codeKey → consecutive failed attempts
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
    let retry = false;
    batch.forEach(([ck, it]) => {
      inFlight.current.delete(ck);
      const t = map[baseKey(it)];
      if (t) {
        cache.current.set(ck, { original: it.text, value: t });
        attempted.current.set(ck, it.text); // got it — never re-request this text+lang
        changed = true;
      } else {
        // A miss usually means a TRANSIENT failure (Gemini 5xx, a not-yet-deployed
        // function, a one-off empty batch). Don't permanently fall back to English —
        // retry a couple of times before giving up, so non-cached languages self-heal.
        const n = (fails.current.get(ck) ?? 0) + 1;
        fails.current.set(ck, n);
        if (n >= 2) attempted.current.set(ck, it.text); // give up after 2 tries
        else { pending.current.set(ck, it); retry = true; }
      }
    });
    if (changed) setVersion((v) => v + 1);
    if (retry && !timer.current) timer.current = setTimeout(flush, 1500);
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
