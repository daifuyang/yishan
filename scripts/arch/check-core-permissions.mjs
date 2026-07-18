#!/usr/bin/env node
/**
 * Statically audits the Core permission annotations and their route use.
 * Plugin permissions intentionally stay out of this check: their manifest is
 * their source of truth and is validated by check-manifest.mjs.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const apiRoot = join(root, 'apps/yishan-api');
const sourceRoot = join(apiRoot, 'src');
const definitionsFile = join(sourceRoot, 'constants/permission-codes.ts');
const output = join(sourceRoot, 'generated/core-permission-route-audit.json');
const write = process.argv.includes('--write');

function listTs(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) listTs(file, files);
    else if (entry.name.endsWith('.ts')) files.push(file);
  }
  return files;
}

function constantKey(code) {
  if (code === 'system:api-token:manage') return 'API_TOKEN_MANAGE';
  return code.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
}

const definitions = readFileSync(definitionsFile, 'utf8');
const annotationRe = /\{\s*code:\s*["']([^"']+)["']\s*,\s*group:\s*["']system["']\s*,\s*label:\s*["']([^"']+)["']/g;
const annotations = [];
for (const match of definitions.matchAll(annotationRe)) {
  annotations.push({ code: match[1], label: match[2], key: constantKey(match[1]) });
}
const errors = [];
const seen = new Set();
for (const annotation of annotations) {
  if (!annotation.label.trim()) errors.push(`missing label for ${annotation.code}`);
  if (seen.has(annotation.code)) errors.push(`duplicate Core permission annotation: ${annotation.code}`);
  seen.add(annotation.code);
  if (!new RegExp(`\\b${annotation.key}\\s*:`).test(definitions)) {
    errors.push(`annotation ${annotation.code} has no PERMISSION_CODES.${annotation.key} constant`);
  }
}

const routeFiles = listTs(join(sourceRoot, 'core/routes'));
const routeRefs = [];
for (const file of routeFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/requirePermission\(PERMISSION_CODES\.([A-Z0-9_]+)\)/g)) {
    const key = match[1];
    const annotation = annotations.find((item) => item.key === key);
    if (!annotation) errors.push(`${relative(root, file)} references unannotated ${key}`);
    else routeRefs.push({ code: annotation.code, label: annotation.label, key, file: relative(root, file).split(sep).join('/') });
  }
  if (/requirePermission\((?!PERMISSION_CODES\.)/.test(text)) {
    errors.push(`${relative(root, file)} uses non-annotated requirePermission argument`);
  }
}

const audit = JSON.stringify({ annotations, routes: routeRefs }, null, 2) + '\n';
if (write) {
  mkdirSync(join(sourceRoot, 'generated'), { recursive: true });
  writeFileSync(output, audit);
} else if (!errors.length) {
  try {
    if (readFileSync(output, 'utf8') !== audit) errors.push('generated Core permission route audit is stale; run pnpm permissions:generate');
  } catch {
    errors.push('generated Core permission route audit is missing; run pnpm permissions:generate');
  }
}
if (errors.length) {
  console.error('[arch:core-permissions] FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`[arch:core-permissions] PASS ${annotations.length} annotations, ${routeRefs.length} route references`);
