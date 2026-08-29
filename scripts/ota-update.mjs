// Publish an over-the-air JS update, with the app's public env vars guaranteed
// to be present.
//
// WHY THIS EXISTS
// `eas.json` carries EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY inside each *build*
// profile's `env` block. That is applied when EAS builds a binary — it is NOT
// applied when `eas update` bundles JS. Running `eas update` directly therefore
// produces a bundle where those vars are undefined, which makes
// `isSupabaseConfigured` false (see src/lib/supabase.ts) and ships an app that
// shows "Supabase is not configured" and cannot talk to the backend at all.
//
// That happened once and broke every tester's app until it was rolled back.
// This script reads the values straight out of eas.json, refuses to publish if
// any are missing, and passes them into the bundler.
//
//   npm run ota -- "Fix Ask Aangan hanging on Android"

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = process.env.EAS_PROFILE ?? 'production';

const easJson = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const profile = easJson.build?.[PROFILE];
if (!profile) {
  console.error(`✗ No build profile "${PROFILE}" in eas.json.`);
  process.exit(1);
}

// `apk` extends `production`, so follow one level of inheritance.
const env = { ...(easJson.build?.[profile.extends]?.env ?? {}), ...(profile.env ?? {}) };
const channel = profile.channel ?? easJson.build?.[profile.extends]?.channel;

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) {
  console.error(`✗ Missing from eas.json build.${PROFILE}.env: ${missing.join(', ')}`);
  console.error('  Publishing without these would ship an app that cannot reach Supabase.');
  process.exit(1);
}
if (!channel) {
  console.error(`✗ No channel on build profile "${PROFILE}".`);
  process.exit(1);
}

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  console.error('✗ Give the update a message:  npm run ota -- "what changed"');
  process.exit(1);
}

console.log(`→ Publishing to channel "${channel}" with ${REQUIRED.length} env vars from eas.json (${PROFILE}).`);

// `eas` is a .cmd shim on Windows, so it has to go through a shell — and
// cmd.exe re-joins the argv array into a single string with no quoting, which
// splits a multi-word message into stray positional args. Quote it ourselves.
const useShell = process.platform === 'win32';
const arg = (v) => (useShell ? `"${String(v).replace(/"/g, "'")}"` : v);

// `eas update` refuses to run non-interactively without --environment, and it
// only accepts development | preview | production.
const ENVIRONMENTS = ['development', 'preview', 'production'];
const environment = ENVIRONMENTS.includes(channel) ? channel : 'production';

const res = spawnSync(
  'eas',
  ['update', '--channel', arg(channel), '--environment', environment, '--message', arg(message)],
  {
    cwd: root,
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, ...env },
  },
);

if (res.error) {
  console.error('✗ Could not run `eas` — is eas-cli installed and are you logged in?');
  process.exit(1);
}
process.exit(res.status ?? 1);
