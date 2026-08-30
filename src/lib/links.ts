import { Platform } from 'react-native';

/**
 * Links that survive leaving the app.
 *
 * A link shared into a WhatsApp group has to work for three different people:
 * a neighbour with Aangan installed (open the app), a neighbour without it
 * (send them to the Play Store), and anyone on a laptop (open the website).
 * A raw `aangan://` scheme link only serves the first and silently fails for
 * the other two, so shared links always point at the `/open` page on the web,
 * which sorts out which of the three you are.
 */

export const APP_SCHEME = 'aangan';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.aangan.app';

/** Public web address of this deployment. */
export function siteUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  // On web the origin is authoritative and always right, including previews.
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'https://aangan.app';
}

/** `aangan:///food` — opens the installed app straight at that screen. */
export function deepLink(path: string): string {
  return `${APP_SCHEME}://${normalise(path)}`;
}

/**
 * The link to put in a WhatsApp message. Goes to the `/open` page, which tries
 * the app first and falls back to the store or the website.
 */
export function shareLink(path = '/'): string {
  const p = normalise(path);
  return p === '/' ? `${siteUrl()}/open` : `${siteUrl()}/open?to=${encodeURIComponent(p)}`;
}

function normalise(path: string): string {
  const p = path.trim();
  if (!p || p === '/') return '/';
  return p.startsWith('/') ? p : `/${p}`;
}
