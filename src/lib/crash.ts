import { Platform } from 'react-native';

/**
 * One place every failure goes.
 *
 * The app had 271 bare `catch {}` blocks and no crash reporting, so a failure
 * on a resident's phone reached nobody. This is the seam: everything that
 * would be worth knowing about calls captureException(), and the boundary and
 * the global handlers below route the uncaught ones here too. Today it logs.
 * When Sentry is wired (a native build, so it ships separately) it becomes one
 * line in this file and nothing else changes.
 */

type Extra = Record<string, unknown>;
type Sink = (error: unknown, extra?: Extra) => void;

let sink: Sink = (error, extra) => {
  // eslint-disable-next-line no-console
  console.error('[aangan]', error, extra ?? '');
};

/** Sentry (or anything else) plugs in here. */
export function setCrashSink(next: Sink): void { sink = next; }

export function captureException(error: unknown, extra?: Extra): void {
  try { sink(error, extra); } catch { /* the reporter must never be the crash */ }
}

let installed = false;

/**
 * Catch what nothing else caught.
 *
 * On native, RN's ErrorUtils global handler sees uncaught JS errors. On web,
 * the `error` and `unhandledrejection` events do. Neither had a listener, so
 * an unhandled rejection — a `.then()` with no catch, of which the codebase
 * has plenty — vanished silently. They are recorded now, and in production
 * the app keeps running rather than dying on a non-fatal one.
 */
export function installGlobalHandlers(): void {
  if (installed) return;
  installed = true;

  if (Platform.OS === 'web') {
    const g = globalThis as unknown as Window;
    if (typeof g.addEventListener !== 'function') return;
    g.addEventListener('unhandledrejection', (e) => {
      captureException(e.reason, { source: 'unhandledrejection' });
    });
    g.addEventListener('error', (e) => {
      captureException(e.error ?? e.message, { source: 'window.error' });
    });
    return;
  }

  const utils = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: Error, isFatal?: boolean) => void;
      setGlobalHandler: (h: (e: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    captureException(error, { source: 'ErrorUtils', isFatal: !!isFatal });
    // Dev keeps RN's red box; production lets the boundary draw the screen.
    if (__DEV__ || isFatal) previous(error, isFatal);
  });
}
