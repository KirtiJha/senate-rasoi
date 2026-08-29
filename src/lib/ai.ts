import * as ImageManipulator from 'expo-image-manipulator';

import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Aangan AI client. All AI runs server-side in the `ai-proxy` Edge Function
 * (the Gemini key can never ship in a web bundle), so this module just resizes
 * the photo, calls the function, and degrades gracefully when AI is unavailable.
 */

export type AutofillKind = 'dish' | 'listing' | 'borrow';

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
export interface BorrowAutofill {
  item_name: string;
  description: string;
}

type AutofillResult<K> = K extends 'dish'
  ? DishAutofill
  : K extends 'listing'
    ? ListingAutofill
    : BorrowAutofill;

/** Thrown for an expected, user-facing failure (over quota, unreadable photo). */
export class AIError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
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
async function invokeAi(
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
      supabase.functions.invoke('ai-proxy', { body, signal: controller.signal }),
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
    throw new AIError((data as any).message ?? friendly(bodyErr), bodyErr);
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

export type AskSource = 'dish' | 'tiffin' | 'listing' | 'property' | 'recommend' | 'borrow' | 'post' | 'document' | 'sport' | 'emergency';

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
  if (bodyErr) throw new AIError((data as any).message ?? friendly(bodyErr), bodyErr);
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

/** supabase-js wraps non-2xx responses in a FunctionsHttpError; dig out the JSON. */
async function readInvokeError(error: unknown): Promise<{ message: string; code?: string }> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json();
      return { message: j.message ?? friendly(j.error), code: j.error };
    }
  } catch {
    /* fall through */
  }
  // Nothing parseable came back — most often the `ai-proxy` function is not
  // deployed at all, so the 404 body isn't the JSON shape we expect.
  return { message: 'AI is unavailable right now — the AI service may not be deployed.' };
}
