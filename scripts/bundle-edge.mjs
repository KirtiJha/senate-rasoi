// Generate a single-file copy of the ai-proxy Edge Function, for pasting into
// the Supabase dashboard.
//
// WHY THIS EXISTS
// The function is two files — index.ts and agent.ts — which `supabase
// functions deploy ai-proxy` handles fine. Deploying by hand through the
// dashboard editor means getting two filenames exactly right, and a typo there
// fails at runtime rather than at paste time.
//
// So this concatenates them, strips the cross-file import, and writes one file
// to paste over index.ts in the dashboard.
//
// The output is GENERATED. Never edit it: change index.ts or agent.ts and run
// this again, or the thing you deploy stops matching the thing under review.
//
//   npm run bundle:edge

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dir = join(root, 'supabase', 'functions', 'ai-proxy');

const index = readFileSync(join(dir, 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
const agent = readFileSync(join(dir, 'agent.ts'), 'utf8').replace(/\r\n/g, '\n');

const IMPORT = "import { runAgent } from './agent.ts';\n";
if (!index.includes(IMPORT)) {
  console.error('✗ index.ts no longer imports ./agent.ts — has the layout changed?');
  process.exit(1);
}

// `export` on a top-level declaration is meaningless once inlined, and Deno
// rejects it in a file with no other module syntax.
const inlined = agent.replace(/^export /gm, '');

const out =
  `// ════════════════════════════════════════════════════════════════════\n` +
  `// GENERATED — do not edit. Run \`npm run bundle:edge\` to rebuild.\n` +
  `//\n` +
  `// index.ts + agent.ts, concatenated for pasting into the Supabase\n` +
  `// dashboard's Edge Function editor. Paste this over the WHOLE contents of\n` +
  `// the ai-proxy function's index.ts, then Deploy.\n` +
  `//\n` +
  `// The repo keeps the two-file split; \`supabase functions deploy ai-proxy\`\n` +
  `// uses that and ignores this file.\n` +
  `// ════════════════════════════════════════════════════════════════════\n\n` +
  index.replace(IMPORT, '') +
  '\n\n' +
  `// ════════════════════════════════════════════════════════════════════\n` +
  `// ── agent.ts, inlined ───────────────────────────────────────────────\n` +
  `// ════════════════════════════════════════════════════════════════════\n\n` +
  inlined;

// Cheap guards against shipping something that cannot possibly work.
const required = ['Deno.serve', 'runAgent', "action === 'agent'", 'AGENT_MODEL'];
const missing = required.filter((r) => !out.includes(r));
if (missing.length) {
  console.error('✗ bundle is missing: ' + missing.join(', '));
  process.exit(1);
}
const stray = out.match(/from '\.\/[^']*'/g);
if (stray) {
  console.error('✗ bundle still has relative imports: ' + stray.join(', '));
  process.exit(1);
}

const target = join(dir, 'dashboard-bundle.ts');
writeFileSync(target, out);
console.log(`✓ ${out.split('\n').length} lines → supabase/functions/ai-proxy/dashboard-bundle.ts`);
