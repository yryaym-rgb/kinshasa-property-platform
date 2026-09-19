#!/usr/bin/env node
/**
 * Builds JSON for Supabase MCP deploy_edge_function (dependency-closed bundle).
 * Usage: node scripts/build-edge-deploy-payload.mjs payment-webhook > /tmp/payload.json
 */
import fs from 'node:fs';
import path from 'node:path';

const fnName = process.argv[2];
if (!fnName) {
  console.error('Usage: node scripts/build-edge-deploy-payload.mjs <function-name>');
  process.exit(1);
}

const root = path.resolve('supabase/functions');
const fnDir = path.join(root, fnName);
const entry = path.join(fnDir, 'index.ts');
if (!fs.existsSync(entry)) {
  console.error(`Missing ${entry}`);
  process.exit(1);
}

function minifyTs(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolveTs(fromFile, spec) {
  let base = path.resolve(path.dirname(fromFile), spec);
  if (!base.endsWith('.ts')) base += '.ts';
  return base;
}

/** Collect local .ts dependencies reachable from entry (static import graph). */
function collectDeps(absEntry) {
  const seen = new Set();
  const stack = [absEntry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g)) {
      stack.push(resolveTs(file, m[1]));
    }
    for (const m of text.matchAll(/\bimport\s*['"](\.\.?\/[^'"]+)['"]/g)) {
      stack.push(resolveTs(file, m[1]));
    }
  }
  return [...seen].filter((f) => f.endsWith('.ts') && !f.endsWith('_test.ts'));
}

const deps = collectDeps(entry);
const files = [{ name: 'index.ts', content: minifyTs(fs.readFileSync(entry, 'utf8')) }];

for (const abs of deps) {
  if (abs === entry) continue;
  const relFromFn = path.relative(fnDir, abs).split(path.sep).join('/');
  const deployName = relFromFn.startsWith('..') ? relFromFn : relFromFn;
  files.push({ name: deployName, content: minifyTs(fs.readFileSync(abs, 'utf8')) });
}

files.push({ name: 'deno.json', content: fs.readFileSync(path.join(root, 'deno.json'), 'utf8') });

const payload = {
  project_id: 'moxfwfxmdctkvjbfvxgx',
  name: fnName,
  entrypoint_path: 'index.ts',
  import_map_path: 'deno.json',
  verify_jwt: fnName !== 'payment-webhook',
  files,
};

process.stdout.write(JSON.stringify(payload));
