import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { colorScheme as nativeWindColorScheme } from 'nativewind';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeCtx {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  toggle: () => void;
  setPreference: (p: ThemePreference) => void;
}

const Ctx = createContext<ThemeCtx>({
  preference: 'system',
  resolved: 'light',
  toggle: () => {},
  setPreference: () => {},
});

export function useThemePreference() {
  return useContext(Ctx);
}

const KEY = 'senate_theme';

/**
 * Move NativeWind's own colour scheme, which is what `bg-bg` / `text-ink` and
 * every other themed className actually resolve against — our React context
 * alone never reached them, so the toggle only ever flipped the imperative
 * colours in src/theme.ts (icons, StatusBar) and left the UI half-light.
 *
 * Every platform. This used to skip web because under Tailwind's `media`
 * dark mode the call throws there — and it was still throwing on every
 * launch, because the guard covered our one call site and nothing else.
 * tailwind.config.js now sets darkMode: 'class', which is what NativeWind
 * asks for when an app controls its own scheme, so the call is legal
 * everywhere. Wrapped anyway: a theme preference must never take the app down.
 */
function syncNativeWind(pref: ThemePreference) {
  try { nativeWindColorScheme.set(pref); } catch { /* cosmetic — never fatal */ }
}

function syncDOM(pref: ThemePreference) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', pref);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setPref(v);
        syncDOM(v);
        syncNativeWind(v);
      }
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    syncDOM(p);
    syncNativeWind(p);
    AsyncStorage.setItem(KEY, p);
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  return (
    <Ctx.Provider value={{ preference, resolved, toggle, setPreference }}>
      {children}
    </Ctx.Provider>
  );
}
