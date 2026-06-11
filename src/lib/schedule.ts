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

// ── Reverse parsers (formatted label → editable input), for the edit form ──
export function parseDaysLabel(s: string | null | undefined): number[] {
  if (!s) return [];
  const t = s.trim();
  if (/daily/i.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/weekend/i.test(t)) return [0, 6];
  if (/mon.?fri/i.test(t)) return [1, 2, 3, 4, 5];
  const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const out: number[] = [];
  for (const part of t.split(/[,\s]+/)) {
    const k = part.slice(0, 3).toLowerCase();
    if (k in map) out.push(map[k]);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function parseTimeLabel(s: string | null | undefined): string {
  if (!s) return '';
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(s.trim());
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function parseDurationLabel(s: string | null | undefined): string {
  if (!s) return '';
  const minOnly = /^(\d+)\s*min/i.exec(s.trim());
  if (minOnly) return minOnly[1];
  const hM = /(\d+)\s*h/i.exec(s);
  const mM = /(\d+)\s*m(?!in)/i.exec(s.replace(/\d+\s*h/i, ''));
  const total = (hM ? parseInt(hM[1], 10) * 60 : 0) + (mM ? parseInt(mM[1], 10) : 0);
  return total ? String(total) : '';
}

/** Has this session's end time passed (so the split is final)? */
export function sessionEnded(dateISO: string, hhmm: string, durationMin: number): boolean {
  const t = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '00:00').trim());
  const start = new Date(dateISO + 'T00:00:00');
  if (t) start.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return Date.now() >= start.getTime() + (durationMin || 0) * 60000;
}

/** Has this session's start time passed? Dues go live at game time, not only at the end. */
export function sessionStarted(dateISO: string, hhmm: string): boolean {
  const t = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '00:00').trim());
  const start = new Date(dateISO + 'T00:00:00');
  if (t) start.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return Date.now() >= start.getTime();
}

/** Members can't change their own RSVP this many minutes after start (the booker can). */
export const RSVP_LOCK_MIN = 15;
export function rsvpLocked(dateISO: string, hhmm: string): boolean {
  const t = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '00:00').trim());
  const start = new Date(dateISO + 'T00:00:00');
  if (t) start.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return Date.now() >= start.getTime() + RSVP_LOCK_MIN * 60000;
}
