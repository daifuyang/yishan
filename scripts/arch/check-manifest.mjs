#!/usr/bin/env node
/**
 * Plugin manifest sanity check (Wave 4).
 *
 * Scans every `plugins/<vendor>/<slug>/plugin.ts` and enforces:
 *
 *   M1 — plugin `id` matches `^[\w-]+/[\w-]+$`
 *   M2 — every manifest's `id` is unique across the scanned set
 *   M3 — `version` matches semver `^\d+\.\d+\.\d+`
 *   M4 — `coreVersion` matches a semver range `^[~^]?\d+\.\d+\.\d+`
 *   M5 — `permissions` is an array
 *   M6 — `menus` is an array
 *   M7 — when present, `api.prefix` starts with `/api/` and equals
 *        `/api/plugins/<id>/v1` derived from `id`
 *   M8 — manifest kind (when present) is `sample` or `production`
 *
 * Implementation: pure RegExp + brace counter. The manifest body is the
 * first balanced `{ ... }` inside `export default { ... }`. A small
 * tokenizer then parses string literals, arrays, and nested objects so
 * menu/permission entries can be validated. No tsx/Node import needed.
 *
 * The Wave 2 legacy behavior of scanning
 *   apps/yishan-api/src/plugins/modules/<name>/manifest.ts
 * is intentionally NOT preserved — PROPOSAL §2.2 names
 *   plugins/<vendor>/<slug>/plugin.ts
 * the only plugin manifest. We still tolerate the legacy tree being
 * absent (zero manifests to validate) so a fresh repo does not fail.
 *
 * Exit codes: 0 = clean, 1 = violations found.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const PLUGINS_DIR = join(ROOT, "plugins");
const PLUGIN_FILES = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((vendor) =>
        readdirSync(join(PLUGINS_DIR, vendor.name), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => `plugins/${vendor.name}/${entry.name}/plugin.ts`),
      )
  : [];

const PLUGIN_ID_RE = /^[\w-]+\/[\w-]+$/;
const VERSION_RE = /^\d+\.\d+\.\d+/;
const VERSION_RANGE_RE = /^[\^~]?\d+\.\d+\.\d+/;
const STRING_RE = /^(['"])((?:\\.|(?!\1).)*)\1/;
const KEY_RE = /^\s*([A-Za-z_$][\w$]*)\s*:\s*/;

// Balanced pair finder. Honors strings, comments, and template literals.
function findPair(text, open, openChar, closeChar) {
  let depth = 1, i = open + 1, s = null, L = false, B = false, T = 0;
  while (i < text.length) {
    const c = text[i], c2 = text[i + 1];
    if (L) { if (c === "\n") L = false; i++; continue; }
    if (B) { if (c === "*" && c2 === "/") { B = false; i += 2; continue; } i++; continue; }
    if (s) { if (c === "\\") { i += 2; continue; } if (c === s) s = null; i++; continue; }
    if (T) { if (c === "\\") { i += 2; continue; }
             if (c === "`") { T--; i++; continue; }
             if (c === "$" && c2 === "{") { T++; i += 2; continue; } i++; continue; }
    if (c === "/" && c2 === "/") { L = true;  i += 2; continue; }
    if (c === "/" && c2 === "*") { B = true;  i += 2; continue; }
    if (c === '"' || c === "'")  { s = c;     i++;     continue; }
    if (c === "`")               { T = 1;     i++;     continue; }
    if (c === openChar)  { depth++; i++; continue; }
    if (c === closeChar) { depth--; if (depth === 0) return i + 1; i++; continue; }
    i++;
  }
  return text.length;
}

// Parse an array body (no surrounding brackets) into items: `{ kind:
// "string", value }` or `{ kind: "object", value: <object> }`.
function parseArray(body) {
  const items = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] === "{") {
      const end = findPair(body, i, "{", "}");
      items.push({ kind: "object", value: parseObject(body.slice(i + 1, end - 1)) });
      i = end;
    } else {
      const sm = STRING_RE.exec(body.slice(i));
      if (!sm) break;
      items.push({ kind: "string", value: sm[2] });
      i += sm[0].length;
    }
  }
  return items;
}

// Skip a non-container value expression (arrow function, identifier,
// number, call, etc.) starting at `start`, returning the index of the next
// top-level comma or end of body. Respects nested (), [], {}, strings,
// template literals and comments so arrow functions like
// `() => import('./api/register.js')` are consumed whole.
function skipExpr(text, start) {
  let i = start, depth = 0, s = null, T = 0, L = false, B = false;
  while (i < text.length) {
    const c = text[i], c2 = text[i + 1];
    if (L) { if (c === "\n") L = false; i++; continue; }
    if (B) { if (c === "*" && c2 === "/") { B = false; i += 2; continue; } i++; continue; }
    if (s) { if (c === "\\") { i += 2; continue; } if (c === s) s = null; i++; continue; }
    if (T) { if (c === "\\") { i += 2; continue; } if (c === "`") { T--; i++; continue; } if (c === "$" && c2 === "{") { T++; i += 2; continue; } i++; continue; }
    if (c === "/" && c2 === "/") { L = true; i += 2; continue; }
    if (c === "/" && c2 === "*") { B = true; i += 2; continue; }
    if (c === '"' || c === "'") { s = c; i++; continue; }
    if (c === "`") { T = 1; i++; continue; }
    if (c === "(" || c === "[" || c === "{") { depth++; i++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth--; i++; continue; }
    if (c === "," && depth === 0) return i;
    i++;
  }
  return i;
}

function parseObject(body) {
  const out = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;
    const km = KEY_RE.exec(body.slice(i));
    if (!km) { i++; continue; }
    const key = km[1];
    i += km[0].length;
    if (body[i] === "{") {
      const end = findPair(body, i, "{", "}");
      out[key] = { kind: "object", value: parseObject(body.slice(i + 1, end - 1)) };
      i = end;
    } else if (body[i] === "[") {
      const end = findPair(body, i, "[", "]");
      out[key] = { kind: "array", value: parseArray(body.slice(i + 1, end - 1)) };
      i = end;
    } else {
      const sm = STRING_RE.exec(body.slice(i));
      if (sm) { out[key] = { kind: "string", value: sm[2] }; i += sm[0].length; }
      else {
        // Non-container value (arrow function, identifier, number, …).
        // Record the key's presence and skip its expression so following
        // keys still parse. Needed so `api.register: () => import(...)` is
        // seen as present.
        out[key] = { kind: "expr" };
        i = skipExpr(body, i);
      }
    }
  }
  return out;
}

function parseManifest(text) {
  // Accept either `export default { ... }` (object literal) or
  // `export default <ident> [as PluginManifest]` (bound to an
  // earlier `definePlugin({...})` call). The hello SDK convention uses
  // the latter via `manifest = definePlugin({...})`.
  const mLiteral = /export\s+default\s*\{/.exec(text);
  if (mLiteral) {
    const open = mLiteral.index + mLiteral[0].length - 1;
    const end = findPair(text, open, "{", "}");
    return parseObject(text.slice(open + 1, end - 1));
  }
  const mBound = /export\s+default\s+([A-Za-z_$][\w$]*)/.exec(text);
  if (mBound) {
    const ident = mBound[1];
    // Find the assignment to <ident>: `<ident> = ...` The SDK convention
    // is `const manifest = definePlugin({...})`. We accept either a
    // literal `{...}` (rare) or a call whose argument is `{...}`.
    const re = new RegExp(`(?:^|[\\s;])(?:const|let|var)?\\s*${ident}\\s*=\\s*`);
    const opening = re.exec(text);
    if (!opening) return null;
    // Now skip whitespace. If we hit `{`, parse directly. If we hit a
    // call like `definePlugin(...)`, walk past the argument list and
    // find the inner `{`. Otherwise bail.
    let i = opening.index + opening[0].length;
    while (i < text.length && /[\s]/.test(text[i])) i++;
    if (text[i] === "{") {
      const open = i;
      const end = findPair(text, open, "{", "}");
      return parseObject(text.slice(open + 1, end - 1));
    }
    // We may be looking at the start of a function-call wrapper like
    // `definePlugin(...)`. Walk the identifier (or chain of dots and
    // identifiers), then expect `(`, then walk through the call argument
    // list looking for the first balanced `{` — that is the manifest body.
    if (/[A-Za-z_$]/.test(text[i])) {
      while (i < text.length && /[\w$.]/.test(text[i])) i++;
      while (i < text.length && /[\s]/.test(text[i])) i++;
    }
    if (text[i] !== "(") return null;
    // Walk the call argument list (the `(...)`) and capture the first
    // balanced `{` we encounter at our depth.
    let depth = 1;
    let stringDelim = null;
    let inLineComment = false;
    let inBlockComment = false;
    let templateDepth = 0;
    i++;
    let manifestOpen = -1;
    while (i < text.length && depth > 0) {
      const c = text[i];
      const c2 = text[i + 1];
      if (inLineComment) { if (c === "\n") inLineComment = false; i++; continue; }
      if (inBlockComment) { if (c === "*" && c2 === "/") { inBlockComment = false; i += 2; continue; } i++; continue; }
      if (stringDelim) {
        if (c === "\\") { i += 2; continue; }
        if (c === stringDelim) stringDelim = null;
        i++; continue;
      }
      if (c === "/" && c2 === "/") { inLineComment = true; i += 2; continue; }
      if (c === "/" && c2 === "*") { inBlockComment = true; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { stringDelim = c; i++; continue; }
      if (c === "(") depth++;
      else if (c === ")") { depth--; i++; continue; }
      if (depth === 1 && c === "{" && manifestOpen === -1) {
        manifestOpen = i;
      }
      i++;
    }
    if (manifestOpen === -1) return null;
    const end = findPair(text, manifestOpen, "{", "}");
    return parseObject(text.slice(manifestOpen + 1, end - 1));
  }
  return null;
}

const s = (v) => v?.kind === "string" ? v.value : null;
const sArr = (v) =>
  v && v.kind === "array" ? v.value.map((x) => (x.kind === "string" ? x.value : null)).filter(Boolean) : null;
const objValue = (v) => (v && v.kind === "object" ? v.value : null);

function checkManifest(file, obj, out) {
  const push = (rule, msg) => out.push({ file, line: 1, rule, msg });
  const id = s(obj.id);
  if (!id) push("M1", "manifest missing id");
  else if (!PLUGIN_ID_RE.test(id)) push("M1", `id '${id}' does not match ^[\\w-]+/[\\w-]+$`);

  const version = s(obj.version);
  if (!version || !VERSION_RE.test(version)) push("M3", `version '${version ?? "?"}' does not match semver ^\\d+\\.\\d+\\.\\d+`);

  const coreVersion = s(obj.coreVersion);
  if (!coreVersion || !VERSION_RANGE_RE.test(coreVersion)) {
    push("M4", `coreVersion '${coreVersion ?? "?"}' does not match semver range ^${VERSION_RANGE_RE.source}`);
  }

  const permissions = obj.permissions;
  if (!permissions || permissions.kind !== "array") {
    push("M5", "permissions must be an array");
  }

  const menus = obj.menus;
  if (!menus || menus.kind !== "array") {
    push("M6", "menus must be an array");
  }

  const api = objValue(obj.api);
  if (!api) {
    push("M7", "api must be an object with prefix and register");
  } else {
    const apiPrefix = s(api.prefix);
    if (!apiPrefix) {
      push("M7", "api.prefix is required");
    } else if (!apiPrefix.startsWith("/api/")) {
      push("M7", `api.prefix '${apiPrefix}' must start with /api/`);
    } else if (id && apiPrefix !== `/api/plugins/${id}/v1`) {
      push("M7", `api.prefix '${apiPrefix}' must equal /api/plugins/${id}/v1 (derived from id)`);
    }
    if (!api.register) {
      push("M7", "api.register is required (function returning Promise<{ default: FastifyPluginAsync }>)");
    }
  }

  const kind = s(obj.kind);
  if (kind !== undefined && kind !== "sample" && kind !== "production") {
    push("M8", `kind '${kind}' must be 'sample' or 'production'`);
  }
}

function checkUniqueness(parsed, getField, rule, label) {
  const map = new Map();
  for (const p of parsed) {
    const v = getField(p.obj);
    if (!v || map.has(v)) {
      if (v && map.has(v)) p.violations.push({
        file: p.file, line: 1, rule,
        msg: `${label} '${v}' duplicates ${relative(ROOT, map.get(v))}`,
      });
    } else map.set(v, p.file);
  }
}

function main() {
  if (PLUGIN_FILES.length === 0) {
    console.log("[arch:manifest] PASS 0 violation(s) (no plugins/*/*/plugin.ts found)");
    process.exit(0);
  }

  const parsed = PLUGIN_FILES.map((rel) => {
    const file = join(ROOT, rel);
    let obj = null;
    try {
      obj = parseManifest(readFileSync(file, "utf8"));
    } catch {
      obj = null;
    }
    return { file, obj, violations: [] };
  });

  for (const p of parsed) {
    if (!p.obj) {
      p.violations.push({ file: p.file, line: 1, rule: "M0", msg: "could not parse manifest body" });
      continue;
    }
    checkManifest(p.file, p.obj, p.violations);
  }

  const withObj = parsed.filter((q) => q.obj);
  checkUniqueness(withObj, (o) => o.id?.value, "M2", "id");

  const violations = parsed.flatMap((p) => p.violations);
  if (violations.length === 0) {
    console.log(`[arch:manifest] PASS 0 violation(s) across ${parsed.length} plugin(s)`);
    process.exit(0);
  }
  console.log(`[arch:manifest] FAIL ${violations.length} violation(s):`);
  for (const v of violations) {
    const rel = relative(ROOT, v.file).split(sep).join("/");
    console.log(`  ${rel}:${v.line}:1 — ${v.msg}`);
  }
  process.exit(1);
}

main();
