import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHROME_STRINGS } from '../lib/chromeStrings';
import { langByCode, translateBatch } from '../lib/translate';
import { useAuth } from './auth';

/**
 * The app, in the resident's language.
 *
 * The twelve-language picker translated neighbours' posts and left every
 * label, tab, header and button in English — a Kannada feed inside an
 * English app, which is the wrong half of the problem.
 *
 * This translates the app's own words. It is a different job from the
 * content translator next door, and it is done differently:
 *
 *  • ONE request, ever, per language. The chrome is a closed set of about
 *    ninety strings, so it is translated as a batch the first time somebody
 *    picks a language and then read from disk forever after.
 *  • Cached on the device, not per society, because "Cancel" is "Cancel"
 *    everywhere.
 *  • English costs nothing at all: no request, no storage, no re-render.
 *
 * `t()` returns the English immediately and the translation once it lands,
 * so a slow network shows a working app rather than a blank one.
 */
const KEY = (code: string) => `aangan:chrome:${code}:v1`;

const Ctx = createContext<{ t: (s: string) => string; ready: boolean }>({ t: (s) => s, ready: true });

export function useChrome() { return useContext(Ctx); }

/** Shorthand for the common case: `const t = useT();  t('Cancel')`. */
export function useT(): (s: string) => string { return useContext(Ctx).t; }

export function ChromeLangProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const code = profile?.preferred_lang && profile.preferred_lang !== 'en' ? profile.preferred_lang : null;
  const [map, setMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let live = true;
    if (!code) { setMap(null); return () => { live = false; }; }

    (async () => {
      // 1. Disk. After the first time, this is the whole story.
      try {
        const raw = await AsyncStorage.getItem(KEY(code));
        if (raw && live) {
          const cached = JSON.parse(raw) as Record<string, string>;
          setMap(cached);
          // A release that adds strings should not re-translate the lot.
          if (CHROME_STRINGS.every((s) => cached[s])) return;
        }
      } catch { /* fall through to fetching */ }

      const lang = langByCode(code);
      if (!lang) return;
      try {
        // The translate action takes fifty items a call and the chrome is
        // about ninety strings, so it goes in chunks — once, ever.
        const CHUNK = 40;
        const next: Record<string, string> = {};
        for (let start = 0; start < CHROME_STRINGS.length; start += CHUNK) {
          const slice = CHROME_STRINGS.slice(start, start + CHUNK);
          const items = slice.map((text, i) => ({ source: 'chrome', id: String(start + i), field: 'text', text }));
          const out = await translateBatch(lang.name, items);
          if (!live) return;
          slice.forEach((text, i) => {
            const got = out[`chrome:${start + i}:text`];
            if (got && got.trim()) next[text] = got.trim();
          });
        }
        if (!Object.keys(next).length) return;
        setMap(next);
        AsyncStorage.setItem(KEY(code), JSON.stringify(next)).catch(() => {});
      } catch {
        // The app stays in English. That is a worse experience, not a broken one.
      }
    })();

    return () => { live = false; };
  }, [code]);

  const t = useCallback((s: string) => (map && map[s]) || s, [map]);
  const value = useMemo(() => ({ t, ready: !code || !!map }), [t, code, map]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
