/**
 * The 6-digit PIN is the whole password.
 *
 * Aangan signs in with a phone number and a six-digit code, and the code is
 * all that stands between a phone number — which every neighbour knows — and
 * somebody's account. The only rule was /^\d{6}$/, so "123456" and "000000"
 * were accepted, and those are the first two guesses anybody makes.
 *
 * This refuses the handful of patterns that are not really secrets. It is
 * deliberately a short list: a resident who is locked out of their own society
 * app by fussy rules is a worse outcome than a slightly weak PIN, so anything
 * that is not an obvious sequence, a repeat, or a famous number goes through.
 */

/** Repeats (111111), and runs in either direction (123456, 987654). */
function isRunOrRepeat(pin: string): boolean {
  const d = pin.split('').map(Number);
  if (d.every((x) => x === d[0])) return true;
  const up = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const down = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  return up || down;
}

/** Numbers people pick because they are memorable, not because they are secret. */
const NOTORIOUS = new Set([
  '123123', '112233', '121212', '123321', '696969', '007007',
  '786786', '143143', '420420', '999999', '101010', '110011',
]);

/** null when the PIN is acceptable; otherwise the sentence to show. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return 'Your PIN must be exactly 6 digits';
  if (isRunOrRepeat(pin)) return 'That PIN is too easy to guess — avoid runs like 123456 or repeats like 111111';
  if (NOTORIOUS.has(pin)) return 'That PIN is one of the most common ones — please pick another';
  return null;
}

/**
 * A birth year in the middle of a PIN (e.g. 041995) is common enough to be
 * worth a nudge, but not worth refusing — the person may have no other way to
 * remember it.
 */
export function pinIsWeakish(pin: string): boolean {
  return /^(19|20)\d{4}$/.test(pin) || /(19|20)\d{2}$/.test(pin);
}
