#!/usr/bin/env node
/**
 * Architecture boundary check.
 *
 * Enforces two structural invariants across `apps/yishan-api/src/**`:
 *
 *   R1 — `core/services/**`, `core/routes/**`, and the corresponding
 *        `plugins/modules/<name>/services/**` + `plugins/modules/<name>/routes/**`
 *        layers MUST NOT import the Drizzle client / schema directly.
 *        All DB access in those layers must go through
 *        `core/repositories/**` (core) or `plugins/modules/<name>/repositories/**`
 *        (plugin). The forbidden module specifiers are `@/db`,
 *        `@/db/schema`, `@/db/schema/...`, and `import type { ... } from
 *        "@/db"` (AppQueryDb is an implementation detail of Repository).
 *
 *   R2 — NO file under `src/**` may reference Prisma in any form
 *        (import, type import, dynamic import, JSDoc, string literal, or
 *        `require(...)`). Triggers on the substrings `@prisma/` and the
 *        quoted strings `"prisma"` / `'prisma'`. Prisma has been fully
 *        replaced by Drizzle and must not regress.
 *
 * To disable a single violation (reserved, not wired up yet): add
 * `// arch-disable R1` or `// arch-disable R2` on the offending line.
 *
 * Exit codes: 0 = clean, 1 = violations found.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const API_SRC = join(ROOT, "apps", "yishan-api", "src");
const API_DB_DIR = join(API_SRC, "db");

const R1_FROM_PATTERNS = [
  /from\s+["']@\/db["']/,
  /from\s+["']@\/db\/schema["']/,
  /from\s+["']@\/db\/schema\/[^"']+["']/,
];
const R2_PATTERNS = [/@prisma\//, /["']prisma["']/];

function listFiles(dir, exts, skipDir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDir && p === skipDir) continue;
      out.push(...listFiles(p, exts, skipDir));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(p);
    }
  }
  return out;
}

function checkR1(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*import\b/.test(line)) continue;
    // Single-line import: from "..." is on the same line.
    if (R1_FROM_PATTERNS.some((re) => re.test(line))) {
      hits.push({ line: i + 1, text: line.trim() });
      continue;
    }
    // Multi-line import: accumulate until we find `from "..."` or run out.
    let acc = line;
    let matched = false;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      acc += "\n" + lines[j];
      if (R1_FROM_PATTERNS.some((re) => re.test(acc))) {
        matched = true;
        break;
      }
      if (/from\s+["'][^"']+["']\s*;?\s*$/.test(acc)) break;
    }
    if (matched) hits.push({ line: i + 1, text: line.trim() + " \\" });
  }
  return hits;
}

function checkR2(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (R2_PATTERNS.some((re) => re.test(lines[i]))) {
      hits.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return hits;
}

function main() {
  const violations = [];

  // R1: scan services + routes under core/ AND plugin module services +
  // routes for direct DB imports. Plugin modules are organized as
  // `plugins/modules/<name>/services/**` and `plugins/modules/<name>/routes/**`,
  // so we recurse one level under `plugins/modules/`.
  const pluginModulesDir = join(API_SRC, "plugins", "modules");
  const r1ServiceRoots = [
    join(API_SRC, "core", "services"),
  ];
  const r1RouteRoots = [
    join(API_SRC, "core", "routes"),
  ];
  try {
    for (const entry of readdirSync(pluginModulesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      r1ServiceRoots.push(join(pluginModulesDir, entry.name, "services"));
      r1RouteRoots.push(join(pluginModulesDir, entry.name, "routes"));
    }
  } catch {
    // plugins/modules may not exist yet; ignore.
  }

  const r1Files = [
    ...r1ServiceRoots.flatMap((root) => listFiles(root, [".ts", ".tsx"])),
    ...r1RouteRoots.flatMap((root) => listFiles(root, [".ts", ".tsx"])),
  ];
  for (const file of r1Files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const hit of checkR1(lines)) {
      violations.push({ file, line: hit.line, rule: "R1", msg: "services/routes layer must not import @/db" });
    }
  }

  // R2: scan every source file under src/ for any Prisma reference.
  // Skip apps/yishan-api/src/db/** per R3 whitelist.
  const r2Files = listFiles(API_SRC, [".ts", ".tsx"], API_DB_DIR);
  for (const file of r2Files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const hit of checkR2(lines)) {
      violations.push({ file, line: hit.line, rule: "R2", msg: "must not import @prisma/client" });
    }
  }

  if (violations.length === 0) {
    console.log("[arch:boundaries] PASS 0 violation(s)");
    process.exit(0);
  }

  console.log(`[arch:boundaries] FAIL ${violations.length} violation(s):`);
  for (const v of violations) {
    const rel = relative(ROOT, v.file).split(sep).join("/");
    console.log(`  ${rel}:${v.line}:1 — ${v.msg}`);
  }
  process.exit(1);
}

main();