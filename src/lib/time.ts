import type { Slot } from './types';

// Default "order by" cutoff per slot — order before the chef starts cooking.
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
