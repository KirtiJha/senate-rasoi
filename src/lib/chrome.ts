/**
 * Which screens the app's floating chrome belongs on.
 *
 * The bottom bar and the assistant used to render at the root for every
 * signed-in phone screen, so they sat over a dish's "Pay via UPI", over the
 * message composer, over a form's Save — two bars stacked at the bottom of
 * the screen, one of which was navigation the resident did not ask for.
 *
 * The rule: the bar is for browsing. A screen that owns the bottom of the
 * screen — a composer, a sticky action, a form — gets it back.
 */

/** Screens whose own bottom edge is spoken for. */
const BAR_FREE = [
  '/ask',                 // Saathi: composer
  '/post',                // the create flow
  '/messages/',           // a thread: composer  (not /messages, the inbox)
  '/onboard',
  '/sign-in',
  '/landing',
  '/dish/',               // sticky order bar
  '/listing/',            // sticky contact bar
  '/property/',
  '/borrow/',
  '/lost-found/',
  '/feed/',               // a post: comment composer
  '/recommend/',
  '/place/new',
  '/profile/me',          // a long form ending in Save
  '/sports/',             // group chat and court sheets
  '/events/',
  '/delete-account',
];

/** True when the floating bar and assistant should be hidden on this route. */
export function chromeFree(pathname: string): boolean {
  const p = pathname.split('?')[0];
  return BAR_FREE.some((prefix) =>
    prefix.endsWith('/') ? p.startsWith(prefix) && p.length > prefix.length : p === prefix || p.startsWith(prefix + '/'),
  );
}
