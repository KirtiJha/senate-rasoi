import { Platform, Share } from 'react-native';
import type { DishRow } from './types';
import { SLOT_EMOJI } from './types';

// Share a dish to the society WhatsApp group / anywhere. On native this opens
// the OS share sheet; on web it uses the Web Share API when available.
// (Phase B will add real per-dish URLs with link previews.)
export async function shareDish(dish: DishRow): Promise<'shared' | 'unsupported'> {
  const message =
    `${SLOT_EMOJI[dish.slot]} ${dish.dish_name} — ₹${dish.price}/plate\n` +
    `by ${dish.chef_name} (Flat ${dish.flat})\n` +
    `${dish.plates_left} plates left · order on Aangan 🍽️`;

  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: dish.dish_name, text: message });
        return 'shared';
      } catch {
        return 'unsupported';
      }
    }
    return 'unsupported';
  }

  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'unsupported';
  }
}

/**
 * The link that puts a neighbour in the right society.
 *
 * A founder onboards their society and lands in an app with nothing in it and
 * nobody else in it, and nothing anywhere told them the first job is to get
 * their neighbours in. There was no invite of any kind — the only way to bring
 * someone in was to describe the app and hope they picked the same society out
 * of a national list.
 *
 * The URL is the sign-up screen with the society already chosen, which the
 * screen has always understood; it had simply never been handed to anyone.
 */
export const INVITE_BASE = 'https://my-aangan.vercel.app';

export function inviteUrl(communityId: string): string {
  return `${INVITE_BASE}/sign-in?communityId=${encodeURIComponent(communityId)}`;
}

export function inviteMessage(societyName: string, communityId: string): string {
  return (
    `Join ${societyName} on Aangan 🏘️\n\n` +
    `Home food from neighbours, lifts, borrowing, lost & found, society notices — all in one place, ` +
    `private to our society.\n\n` +
    `${inviteUrl(communityId)}`
  );
}

/** Share the invite; returns 'unsupported' when the OS/browser cannot. */
export async function shareInvite(societyName: string, communityId: string): Promise<'shared' | 'unsupported'> {
  const message = inviteMessage(societyName, communityId);
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav && typeof nav.share === 'function') {
      try { await nav.share({ title: `Join ${societyName} on Aangan`, text: message }); return 'shared'; }
      catch { return 'unsupported'; }
    }
    if (nav?.clipboard) {
      try { await nav.clipboard.writeText(message); return 'shared'; } catch { /* fall through */ }
    }
    return 'unsupported';
  }
  try { await Share.share({ message }); return 'shared'; }
  catch { return 'unsupported'; }
}

/** WhatsApp directly — how most societies actually pass things around. */
export function inviteWhatsAppLink(societyName: string, communityId: string): string {
  return `https://wa.me/?text=${encodeURIComponent(inviteMessage(societyName, communityId))}`;
}
