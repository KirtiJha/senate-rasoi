import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Aangan AI client. All AI runs server-side in the `ai-proxy` Edge Function
 * (the Gemini key can never ship in a web bundle), so this module just resizes
 * the photo, calls the function, and degrades gracefully when AI is unavailable.
 */

export type AutofillKind = 'dish' | 'listing' | 'borrow' | 'receipt';

export interface DishAutofill {
  dish_name: string;
  veg_type: 'Veg' | 'Non-veg' | 'Egg';
  suggested_slot?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  description: string;
}
export interface ListingAutofill {
  title: string;
  description: string;
}
/**
 * A bill photographed by a treasurer.
 *
 * Every field is optional in practice — a crumpled thermal receipt may show a
 * total and nothing else, and half a reading still saves most of the typing.
 * The form is prefilled, never submitted: the person who paid checks it.
 */
export interface ReceiptAutofill {
  vendor: string;
  amount: number;
  spent_on: string;
  category: 'decor' | 'food' | 'sound' | 'priest' | 'prizes' | 'venue' | 'gifts' | 'misc';
  title: string;
}
export interface BorrowAutofill {
  item_name: string;
  description: string;
}

type AutofillResult<K> = K extends 'receipt'
  ? ReceiptAutofill
  : K extends 'dish'
  ? DishAutofill
  : K extends 'listing'
    ? ListingAutofill
    : BorrowAutofill;

/** Thrown for an expected, user-facing failure (over quota, unreadable photo). */
export class AIError extends Error {
  constructor(message: string, readonly code?: string) {
    // The chat renders `e.message` straight into a bubble, and `??` at the
    // call sites keeps an empty string ('' is not nullish) — so a blank field
    // from the server reached the UI as a card with nothing in it and no clue
    // what went wrong. Blank in, useful sentence out.
    super(message?.trim() || 'AI is unavailable right now — try again shortly.');
    this.name = 'AIError';
  }
}

// How long to wait before giving up on the Edge Function. Ask can legitimately
// take a while (semantic search, plus a lazy embedding backfill on the first
// question after new items are posted), so these are deliberately generous.
const ASK_TIMEOUT_MS = 60_000;
const AUTOFILL_TIMEOUT_MS = 45_000;
const DIGEST_TIMEOUT_MS = 20_000;

/**
 * Call `ai-proxy` with a hard timeout.
 *
 * `functions.invoke` returns `{ data, error }` for HTTP-level failures, but a
 * transport failure — no route to the host, a stalled connection — rejects, and
 * a request that simply never settles does neither. On the web that is rare; on
 * a phone it is not, and it presented as Ask Aangan spinning forever with
 * nothing to report. Abort instead, and say which of the two happened.
 */
/**
 * Ask for an uncompressed body on native.
 *
 * This was added on the theory that Cloudflare returned Brotli that Android's
 * OkHttp could not decode. Probing the deployed function directly disproves
 * that: offered `gzip, deflate, br` it answers `Content-Encoding: gzip`, never
 * `br`. So this is not the cure for Ask Aangan failing on a phone.
 *
 * It is kept because it is harmless — the bodies here are a chat answer and a
 * handful of result cards — and it takes decompression off the list of things
 * that can differ between a browser and a phone while that is still being
 * diagnosed. Web keeps compression; browsers decode both.
 */
const NO_COMPRESSION_HEADERS: Record<string, string> | undefined =
  Platform.OS === 'web' ? undefined : { 'Accept-Encoding': 'identity' };

export async function invokeAi(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ data: unknown; error: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Race the abort as well as honouring it. Aborting is the clean path, but it
  // only helps if the platform's fetch propagates the signal — and the bug this
  // guards against is precisely a request that never settles. The race
  // guarantees the promise resolves either way, so the UI can never hang.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AIError('AI took too long to respond. Check your connection and try again.', 'timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      supabase.functions.invoke('ai-proxy', {
        body,
        signal: controller.signal,
        headers: NO_COMPRESSION_HEADERS,
      }),
      timeout,
    ]);
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (controller.signal.aborted) {
      throw new AIError('AI took too long to respond. Check your connection and try again.', 'timeout');
    }
    throw new AIError('Could not reach the AI service. Check your connection and try again.', 'network');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Shrink a photo to a small JPEG and return its base64 (no data: prefix). */
async function toBase64(localUri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 768 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!out.base64) throw new AIError('Could not read that photo.');
  return out.base64;
}

/**
 * Ask Gemini (via the Edge Function) to read a photo and suggest form fields.
 * The caller fills its form from the result — the user always edits & confirms.
 * Throws AIError on an expected failure; returns the typed fields on success.
 */
export async function visionAutofill<K extends AutofillKind>(
  kind: K,
  photoUri: string,
  note?: string,
): Promise<AutofillResult<K>> {
  if (!isSupabaseConfigured) throw new AIError('Connect Supabase to use AI.');

  const image = await toBase64(photoUri);
  const { data, error } = await invokeAi(
    { action: 'autofill', kind, note: note?.trim() || undefined, image },
    AUTOFILL_TIMEOUT_MS,
  );

  // Read an application-level error returned either in the body or via a non-2xx.
  const bodyErr = (data as { error?: string; message?: string } | null)?.error;
  if (bodyErr) {
    throw new AIError((data as any).message?.trim() || friendly(bodyErr), bodyErr);
  }
  if (error) {
    const parsed = await readInvokeError(error);
    throw new AIError(parsed.message, parsed.code);
  }

  const result = (data as { result?: AutofillResult<K> } | null)?.result;
  if (!result) throw new AIError('AI is unavailable right now.');
  return result;
}

// ── Ask Aangan (Phase 2) ──────────────────────────────────────────────

export type AskSource =
  | 'dish' | 'tiffin' | 'listing' | 'property' | 'recommend' | 'borrow'
  | 'post' | 'document' | 'sport' | 'emergency'
  // Added with migration 0076, which brought the rest of the app into the
  // semantic index.
  | 'event' | 'place' | 'lostfound' | 'poll' | 'comment' | 'recoanswer';

export interface AskResultItem {
  source: AskSource;
  id: string;
  title: string;
  reason?: string;
}
export interface AskResponse {
  answer: string;
  results: AskResultItem[];
}

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

/** Ask a natural-language question over the society's own listings (with chat history). */
export async function askAangan(question: string, history: ChatTurn[] = []): Promise<AskResponse> {
  if (!isSupabaseConfigured) throw new AIError('Connect Supabase to use AI.');
  const q = question.trim();
  if (!q) throw new AIError('Type a question first.');

  const { data, error } = await invokeAi(
    { action: 'ask', question: q, history: history.slice(-8) },
    ASK_TIMEOUT_MS,
  );

  const bodyErr = (data as { error?: string; message?: string } | null)?.error;
  if (bodyErr) throw new AIError((data as any).message?.trim() || friendly(bodyErr), bodyErr);
  if (error) {
    const parsed = await readInvokeError(error);
    throw new AIError(parsed.message, parsed.code);
  }
  const result = (data as { result?: AskResponse } | null)?.result;
  if (!result) throw new AIError('Ask Aangan is unavailable right now.');
  return { answer: result.answer ?? '', results: result.results ?? [] };
}

/** Deep-link route for an Ask Aangan result card. */
export function askResultRoute(item: AskResultItem): string {
  switch (item.source) {
    case 'dish':
    case 'tiffin':
      return '/food';
    case 'listing':
      return `/listing/${item.id}`;
    case 'property':
      return `/property/${item.id}`;
    case 'recommend':
      return `/recommend/${item.id}`;
    case 'borrow':
      return `/borrow/${item.id}`;
    case 'post':
      return `/feed/${item.id}`;
    case 'sport':
      return `/sports/${item.id}`;
    case 'document':
      return '/documents';
    case 'emergency':
      return '/emergency';
    case 'event':
      return `/events/${item.id}`;
    case 'place':
      return `/place/${item.id}`;
    case 'lostfound':
      return `/lost-found/${item.id}`;
    case 'poll':
      return '/feed';
    // A comment and a recommendation answer are both replies: the useful
    // destination is the thing they are replying to, which the id alone does
    // not name. Sending someone to the parent list beats a dead end.
    case 'comment':
      return '/feed';
    case 'recoanswer':
      return '/recommend';
    default:
      return '/';
  }
}

const SOURCE_META: Record<AskSource, { label: string; icon: string; color: string }> = {
  dish: { label: 'Home food', icon: 'restaurant', color: '#E8650A' },
  tiffin: { label: 'Tiffin', icon: 'fast-food', color: '#F59E0B' },
  listing: { label: 'Listing', icon: 'pricetag', color: '#0F6E56' },
  property: { label: 'Flat', icon: 'key', color: '#7C3AED' },
  recommend: { label: 'Recommendation', icon: 'star', color: '#CA8A04' },
  borrow: { label: 'Borrow', icon: 'swap-horizontal', color: '#0891B2' },
  post: { label: 'Post', icon: 'chatbubbles', color: '#2563EB' },
  document: { label: 'Document', icon: 'document-text', color: '#64748B' },
  sport: { label: 'Sports', icon: 'basketball', color: '#16A34A' },
  emergency: { label: 'Contact', icon: 'call', color: '#DC2626' },
  event: { label: 'Function', icon: 'sparkles', color: '#DB2777' },
  place: { label: 'Nearby', icon: 'location', color: '#0D9488' },
  lostfound: { label: 'Lost & found', icon: 'search', color: '#9333EA' },
  poll: { label: 'Poll', icon: 'stats-chart', color: '#6366F1' },
  comment: { label: 'Comment', icon: 'chatbubble-ellipses', color: '#2563EB' },
  recoanswer: { label: 'Recommended', icon: 'star', color: '#CA8A04' },
};
export function askSourceMeta(source: AskSource) {
  return SOURCE_META[source] ?? { label: 'Result', icon: 'ellipse', color: '#0F6E56' };
}

// ── Weekly society digest (Phase 3) ───────────────────────────────────

export interface SocietyDigest {
  summary: string;
  highlights: string[];
}

/** "This week in your society" — generated once per society per week, cached. */
export async function fetchSocietyDigest(): Promise<SocietyDigest> {
  const empty: SocietyDigest = { summary: '', highlights: [] };
  if (!isSupabaseConfigured) return empty;
  try {
    const { data, error } = await invokeAi({ action: 'digest' }, DIGEST_TIMEOUT_MS);
    if (error) return empty;
    return (data as { digest?: SocietyDigest } | null)?.digest ?? empty;
  } catch {
    return empty;
  }
}

/**
 * Turn an `ai-proxy` error string into something a user can act on.
 *
 * The server's own strings are matched verbatim — without these, a
 * "not configured" 503 surfaced as the autofill-specific "fill the form
 * manually", which is nonsense in Ask Aangan and hides the real cause from
 * whoever has to fix it.
 */
function friendly(code: string): string {
  switch (code) {
    case 'over_quota':
      return "You've used today's AI helper limit. Try again tomorrow.";
    case 'AI is not configured':
      // GEMINI_API_KEY secret missing on the Edge Function — see docs/AI_SETUP.md.
      return 'AI is not set up on the server yet.';
    case 'Not signed in':
      return 'Please sign out and sign in again, then retry.';
    case 'Quota check failed':
      return 'AI is unavailable right now — try again shortly.';
    case 'not_relevant':
      return "That photo doesn't match — pick another, or fill the form in.";
    default:
      return 'AI could not help with this — try again shortly.';
  }
}

/**
 * Turn a supabase-js invoke error into something a user — and whoever has to
 * fix it — can act on.
 *
 * `functions.invoke` never rejects. It catches everything and returns an error
 * whose `.context` is a `Response` for a non-2xx (FunctionsHttpError,
 * FunctionsRelayError) but the raw fetch failure for a transport error
 * (FunctionsFetchError). Reading `.context` as a Response in all three cases
 * made every failure that wasn't a parseable JSON body — every native network
 * failure included — report "the AI service may not be deployed", which is
 * usually false and sends debugging in the wrong direction.
 */
export async function readInvokeError(error: unknown): Promise<{ message: string; code?: string }> {
  const name = (error as { name?: string } | null)?.name;
  const context = (error as { context?: unknown } | null)?.context;
  const res =
    context && typeof (context as Response).json === 'function' ? (context as Response) : undefined;

  if (res) {
    try {
      const j = await res.json();
      if (j?.error || j?.message) return { message: j.message?.trim() || friendly(j.error), code: j.error };
    } catch {
      /* body wasn't the JSON shape we expect — fall through to the status */
    }
    if (res.status === 404) {
      return { message: 'AI is unavailable — the ai-proxy function is not deployed.', code: 'http_404' };
    }
    return { message: `AI is unavailable — the AI service returned ${res.status}.`, code: `http_${res.status}` };
  }

  if (name === 'FunctionsFetchError') {
    // The request never completed. Carry the platform's own words — "Network
    // request failed", a TLS error — because that is the only clue to why the
    // same call succeeds in a browser and not on a phone.
    const why = (context as { message?: string } | null)?.message;
    return {
      message: `Could not reach the AI service${why ? ` (${why})` : ''}. Check your connection and try again.`,
      code: 'network',
    };
  }

  return { message: 'AI is unavailable right now — try again shortly.', code: name };
}
