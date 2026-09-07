/**
 * The words the app itself says.
 *
 * Aangan ships a twelve-language picker, and it translated the neighbours'
 * posts while every label, tab, header, button and empty state stayed in
 * English. A resident who chose Kannada got a Kannada feed inside an
 * English app — which is the wrong half. These are the strings the app
 * speaks in its own voice, gathered so they can be translated as a set.
 *
 * The English text IS the key: nothing to keep in sync, and a missing
 * translation falls back to something readable rather than to `home.tab`.
 */
export const CHROME_STRINGS = [
  // Tabs and the bar
  'Home', 'Feed', 'Inbox', 'You', 'Add something',
  // Top bar and greeting
  'Search your society', 'Ask Saathi', 'Notifications',
  'Good morning', 'Good afternoon', 'Good evening', 'Good night',
  // Home zones and section heads
  'Your society', 'Your neighbours', 'Buy, sell & borrow',
  'Fresh from kitchens', 'Around the aangan', 'See all', 'All categories',
  // The quick row and tiles
  'Residents', 'Emergency', 'Documents', 'Payments', 'Polls', 'Events', 'Blood',
  'Messages', 'Carpool', 'Feedback', 'Borrow', 'Sports', 'Flats', 'Ask',
  // The weekly digest
  'This week', 'Open the feed', 'Hide until next week',
  // The create sheet
  'What would you like to add?',
  'Post to the feed', 'Report an issue', 'Cook something', 'Sell or offer a service',
  'Lend something', 'Ask to borrow', 'Lost or found', 'Start a poll', 'Offer a ride', 'List a flat',
  // Actions that recur everywhere
  'Cancel', 'Save', 'Done', 'Delete', 'Remove', 'Confirm', 'Not now', 'Try again',
  'Send', 'Post', 'Share', 'Edit', 'Close', 'Back', 'Next', 'Skip', 'Optional', 'Required',
  'Call', 'WhatsApp', 'Message', 'Search', 'Filter', 'Sort', 'Add', 'Open', 'Settings',
  // States people meet when there is nothing
  'Nothing here yet', 'No results', 'Loading…', 'Something went wrong',
  'Check your connection and try again', 'Pull down to refresh',
] as const;

export type ChromeString = (typeof CHROME_STRINGS)[number];
