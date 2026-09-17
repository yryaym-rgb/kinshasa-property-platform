#!/usr/bin/env node
/**
 * Mirrors dependency-free modules shared between the Vite frontend and the
 * Deno Edge Functions. Supabase bundles functions from `supabase/functions`
 * only, so the canonical frontend files are copied (with a header) into
 * `_shared`. `npm test` fails when a mirror is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const MIRRORS = [
  {
    source: 'src/services/payment/stateMachine.ts',
    target: 'supabase/functions/_shared/stateMachine.ts',
  },
];

export function header(source) {
  return [
    '/**',
    ` * MIRROR of ${source} — do not edit here.`,
    ' *',
    ' * Supabase bundles Edge Functions from the supabase/functions directory only,',
    ' * so the dependency-free state machine is mirrored into _shared. A unit test',
    ' * (src/services/payment/__tests__/stateMachine.test.ts) fails when the two',
    ' * copies diverge. Edit the frontend file, then run `npm run sync:edge`.',
    ' */',
    '',
    '',
  ].join('\n');
}

export function expectedMirror(sourceRel) {
  return header(sourceRel) + readFileSync(resolve(root, sourceRel), 'utf8');
}

const check = process.argv.includes('--check');
let dirty = false;

for (const { source, target } of MIRRORS) {
  const expected = expectedMirror(source);
  const targetPath = resolve(root, target);
  let current = '';
  try {
    current = readFileSync(targetPath, 'utf8');
  } catch {
    current = '';
  }
  if (current === expected) continue;
  dirty = true;
  if (check) {
    console.error(`✗ ${target} is out of sync with ${source} (run: npm run sync:edge)`);
  } else {
    writeFileSync(targetPath, expected);
    console.log(`✓ ${target} refreshed from ${source}`);
  }
}

if (check && dirty) process.exit(1);
if (!dirty) console.log('✓ edge mirrors up to date');
