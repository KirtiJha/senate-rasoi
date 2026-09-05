import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { captureException, installGlobalHandlers } from './crash';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * What has to happen when the phone wakes up.
 *
 * supabase-js refreshes the auth token on a timer — but on React Native it
 * only runs that timer while told the app is in the foreground, and nothing
 * told it. So a phone that slept for an hour woke with an expired token, and
 * the first tap after resume failed: a 401 the screens rendered as "empty" or
 * as "could not load", indistinguishable from the app being broken.
 *
 * Realtime has the same shape. Its socket dies in the background and the
 * channels every screen subscribed to are simply gone until the next full
 * reload, so a conversation left open overnight stops receiving.
 *
 * Both are one AppState listener. It is also where the global error handlers
 * are installed, because "the app is alive" is the moment to start listening.
 */
export function useAppLifecycle(): void {
  useEffect(() => {
    installGlobalHandlers();
    if (Platform.OS === 'web' || !isSupabaseConfigured) return;

    const onChange = (state: AppStateStatus) => {
      try {
        if (state === 'active') {
          supabase.auth.startAutoRefresh();
          // Reconnect rather than trust the old socket: after a long sleep the
          // heartbeat has long since failed and the client thinks it is fine.
          const rt = supabase.realtime;
          if (!rt.isConnected()) rt.connect();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      } catch (e) {
        captureException(e, { source: 'appLifecycle', state });
      }
    };

    onChange(AppState.currentState);
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      try { supabase.auth.stopAutoRefresh(); } catch { /* unmounting */ }
    };
  }, []);
}
