/** Shared helpers for weekly schedules (practice + court bookings). 0 = Sunday. */

export const DOW_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const DOW_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon, Wed, Fri" / "Daily" / "Weekends" / "Mon–Fri" from a list of weekday indices. */
export function formatDays(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 0) return '';
  if (set.length === 7) return 'Daily';
  if (set.length === 2 && set[0] === 0 && set[1] === 6) return 'Weekends';
  if (set.length === 5 && set.every((d, i) => d === i + 1)) return 'Mon–Fri';
  return set.map((d) => DOW_FULL[d]).join(', ');
}

/** "18:30" → "6:30 PM". Returns the input unchanged if it can't be parsed. */
export function formatTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

/** 90 → "1h 30m", 60 → "1h", 45 → "45 min". */
export function durationLabel(min: number): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Validate an HH:MM 24-hour string. */
export function isValidTime(hhmm: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/**
 * The next `weeks` worth of dates (YYYY-MM-DD) matching the given weekdays,
 * starting from `fromISO` (inclusive). Used to generate court sessions.
 */
export function upcomingDates(days: number[], weeks: number, fromISO?: string): string[] {
  const set = new Set(days);
  const out: string[] = [];
  const start = fromISO ? new Date(fromISO + 'T00:00:00') : new Date();
  start.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, weeks) * 7;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (set.has(d.getDay())) out.push(d.toLocaleDateString('en-CA'));
  }
  return out;
}

/** Has this session's end time passed (so the split is final)? */
export function sessionEnded(dateISO: string, hhmm: string, durationMin: number): boolean {
  const t = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '00:00').trim());
  const start = new Date(dateISO + 'T00:00:00');
  if (t) start.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return Date.now() >= start.getTime() + (durationMin || 0) * 60000;
}
