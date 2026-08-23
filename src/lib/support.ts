/**
 * Single source of truth for how a user reaches the people who make Aangan.
 *
 * App Store Guideline 1.2 requires an app with user-generated content to
 * publish developer contact info, and App Store Connect separately requires a
 * Support URL on the listing. Use the SAME address in both places.
 *
 * ⚠️ Set this to a mailbox you actually monitor before submitting to either
 * store — reports of abuse are expected to get a timely response.
 */
export const SUPPORT_EMAIL = 'powerju2012@gmail.com';

/** Prefilled mailto: link, so "Contact support" opens a ready-to-send mail. */
export function supportMailto(subject = 'Aangan support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
