import { supabase } from './supabase';

/**
 * Multilingual helper. Translation runs server-side in the `ai-proxy` Edge
 * Function (cached in the `translations` table), so this module is just the
 * language list + a batched invoke. The original text is always kept — the UI
 * shows a translation inline with a "see original" toggle.
 */

export interface Lang {
  code: string; // stored in profiles.preferred_lang
  name: string; // English name, sent to the model
  label: string; // native display label
}

// English first (the no-translate default), then the major Indian languages.
export const SUPPORTED_LANGS: Lang[] = [
  { code: 'en', name: 'English', label: 'English' },
  { code: 'hi', name: 'Hindi', label: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', label: 'বাংলা' },
  { code: 'kn', name: 'Kannada', label: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', label: 'தமிழ்' },
  { code: 'te', name: 'Telugu', label: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', label: 'मराठी' },
  { code: 'ml', name: 'Malayalam', label: 'മലയാളം' },
  { code: 'gu', name: 'Gujarati', label: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', label: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', label: 'ଓଡ଼ିଆ' },
  { code: 'ur', name: 'Urdu', label: 'اردو' },
];

export function langByCode(code: string | null | undefined): Lang | null {
  if (!code) return null;
  return SUPPORTED_LANGS.find((l) => l.code === code) ?? null;
}

/** Best-effort guess of the device language → a supported code (else 'en'). */
export function detectDeviceLang(): string {
  try {
    // Web / Hermes both expose navigator.language; native falls back to 'en'.
    const tag = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    const base = tag.toLowerCase().split('-')[0];
    return SUPPORTED_LANGS.some((l) => l.code === base) ? base : 'en';
  } catch {
    return 'en';
  }
}

export interface TranslateItem {
  source: string;
  id: string;
  field: string;
  text: string;
}

/** Translate a batch of items into `targetName` (English language name). */
export async function translateBatch(
  targetName: string,
  items: TranslateItem[],
): Promise<Record<string, string>> {
  if (!items.length) return {};
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { action: 'translate', target_lang: targetName, items },
  });
  if (error) return {};
  return (data as { translations?: Record<string, string> } | null)?.translations ?? {};
}
