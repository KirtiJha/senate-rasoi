import type { Slot } from './types';

// Default "order by" cutoff per slot — order before the chef starts cooking.
/**
 * The one cut-off table.
 *
 * Mirrored by `slot_cutoff_at` in the database (0097), which the nightly
 * recurring-dish job uses. The two used to disagree by up to two and a half
 * hours, so a templated idli closed for orders long before the identical dish
 * typed out by hand. Change one and you must change the other.
 */
const SLOT_CUTOFF_HOUR: Record<Slot, number | null> = {
  Breakfast: 9.5, // 9:30 AM
  Lunch: 12.5, // 12:30 PM
  Dinner: 19.5, // 7:30 PM
  Snack: null, // anytime
};

/**
 * Suggested order-by deadline (ISO) for a dish on `baseDate` (default today),
 * based on its slot. Returns null when there's no sensible deadline (Snack, or
 * the cutoff time has already passed → treat as "order anytime").
 */
export function slotOrderBy(slot: Slot, baseDate?: Date): string | null {
  const hour = SLOT_CUTOFF_HOUR[slot];
  if (hour == null) return null;
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
  if (d.getTime() <= Date.now()) return null;
  return d.toISOString();
}

/** A human countdown to a deadline, plus whether ordering has closed. */
export function countdown(iso: string | null): { closed: boolean; label: string } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { closed: true, label: 'Ordering closed' };
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `Order in ${h}h ${m}m` : `Order in ${m}m`;
  return { closed: false, label };
}

/**
 * Compact relative time — "2h", "yesterday", "12 Aug".
 *
 * Short by design: it sits at the end of a list row where it must not compete
 * with the title, so it is a glance, not a sentence.
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return 'yesterday';
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
