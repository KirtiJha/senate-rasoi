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
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { action: 'autofill', kind, note: note?.trim() || undefined, image },
  });

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

function friendly(code: string): string {
  if (code === 'over_quota') return "You've used today's AI helper limit. Try again tomorrow.";
  return 'AI could not help with this — fill the form manually.';
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
  return { message: 'AI is unavailable right now.' };
}
