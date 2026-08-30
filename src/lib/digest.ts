import type { LendItem } from './borrow';
import type { LostFoundItem } from './lostFound';
import { shareLink } from './links';
import type { DishRow, ListingRow } from './types';

/**
 * The "share today" digest — a short WhatsApp message summarising what is
 * happening in the society right now, ending in a link.
 *
 * Deliberately built from what the Home screen already holds in memory rather
 * than re-fetching: this runs on a button press and must feel instant.
 *
 * Kept short on purpose. WhatsApp truncates long messages behind "Read more",
 * and a digest nobody expands is a digest nobody clicks.
 */

export interface DigestInput {
  societyName?: string | null;
  dishes: DishRow[];
  listings: ListingRow[];
  borrow: LendItem[];
  lostFound: LostFoundItem[];
}

const MAX_DISHES = 3;

/** Returns null when there is genuinely nothing worth posting. */
export function buildDigest(input: DigestInput): string | null {
  const today = new Date().toLocaleDateString('en-CA');
  const lines: string[] = [];

  // Only today's dishes that someone can still order.
  const cooking = input.dishes.filter((d) => d.serve_date <= today && d.plates_left > 0);
  if (cooking.length) {
    const names = cooking.slice(0, MAX_DISHES).map((d) => d.dish_name).join(', ');
    const more = cooking.length > MAX_DISHES ? ` +${cooking.length - MAX_DISHES} more` : '';
    lines.push(`🍲 *${cooking.length} ${cooking.length === 1 ? 'kitchen' : 'kitchens'} cooking today* — ${names}${more}`);
  }

  const fresh = recent(input.listings, (l) => l.created_at);
  if (fresh.length) {
    lines.push(`🛒 *${fresh.length} new ${fresh.length === 1 ? 'listing' : 'listings'}* — ${fresh[0].title}${fresh.length > 1 ? ' and more' : ''}`);
  }

  const needs = input.borrow.filter((b) => b.kind === 'request');
  const lends = input.borrow.filter((b) => b.kind === 'offer');
  if (needs.length) lines.push(`🙏 *${needs.length} neighbour${needs.length === 1 ? '' : 's'} looking to borrow* — ${needs[0].title}`);
  else if (lends.length) lines.push(`🤝 *${lends.length} thing${lends.length === 1 ? '' : 's'} to borrow* — ${lends[0].title}`);

  const lost = input.lostFound.filter((x) => x.status === 'open');
  if (lost.length) {
    const l = lost[0];
    lines.push(`${l.kind === 'lost' ? '🔍' : '📦'} *${l.kind === 'lost' ? 'Lost' : 'Found'}* — ${l.title}`);
  }

  if (!lines.length) return null;

  const heading = input.societyName?.trim()
    ? `🏡 *Today at ${input.societyName.trim()}*`
    : '🏡 *Today on Aangan*';

  return [heading, '', ...lines, '', shareLink('/')].join('\n');
}

/** Items created in the last 24h, newest first. */
function recent<T>(rows: T[], createdAt: (row: T) => string): T[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return rows
    .filter((r) => {
      const t = Date.parse(createdAt(r));
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => createdAt(b).localeCompare(createdAt(a)));
}
