import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

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
      }
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    syncDOM(p);
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
