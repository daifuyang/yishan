#!/usr/bin/env node
/**
 * Route registration sanity check.
 *
 * Scans every file under `apps/yishan-api/src` matching
 *   (core|plugins/modules/<name>)/routes/(api/|v1/)<rest>
 * that contains at least one `route.get|post|put|delete|patch(...)` call
 * and enforces the following per-route invariants.  Paths are computed by
 * concatenating the file's directory path (relative to `src/`) with the
 * route's first string argument, which matches how `@fastify/autoload`
 * stitches the final URL together.
 *
 *   R1 — every non-whitelisted route MUST have a non-empty `schema.summary`
 *   R2 — every non-whitelisted route MUST have a non-empty `schema.operationId`
 *   R3 — every non-whitelisted route MUST have a non-empty `schema.tags`
 *   R4 — every route MUST have a `schema:` block on its options object
 *   R5 — every route MUST explicitly declare an `access` policy
 *
 * Whitelist (these exact full paths escape R1/R2/R3, never R4):
 *   - /api/v1/auth/login
 *   - /api/v1/auth/refresh
 * (Login + token refresh are public endpoints, so they don't need summary,
 *  operationId, or OpenAPI tags — but they still MUST have a schema block.)
 *
 * Implementation: pure RegExp + brace counter over the source text.  Each
 * `fastify.{verb}(` call is located, its first quoted argument is the
 * route path, the matching options object is found by walking brace depth
 * from the opening `{` after the path string, and the schema block is
 * found similarly inside the options object.
 *
 * Exit codes: 0 = clean, 1 = violations found.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const API_SRC = join(ROOT, "apps", "yishan-api", "src");
const WHITELIST = new Set(["/api/v1/auth/login", "/api/v1/auth/refresh"]);

const ROUTE_CALL_RE = /route\.(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(/g;
const LEGACY_ROUTE_CALL_RE = /fastify\.(get|post|put|delete|patch)\s*\(/;
const STRING_RE = /^(['"])((?:\\.|(?!\1).)*)\1/;
const SCHEMA_KEY_RE = /\bschema\s*:/g;
const STRING_FIELD_RE = (k) => new RegExp(`\\b${k}\\s*:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`);

function listRouteFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listRouteFiles(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

// [start, end) of the object value that follows the opening `{` at openIdx.
// Honors strings, comments, and template literals.
function matchBrace(text, openIdx) {
  let depth = 1, i = openIdx + 1;
  let inString = null, inLine = false, inBlock = false, inTpl = 0;
  while (i < text.length) {
    const c = text[i], c2 = text[i + 1];
    if (inLine)   { if (c === "\n") inLine = false; i++; continue; }
    if (inBlock)  { if (c === "*" && c2 === "/") { inBlock = false; i += 2; continue; } i++; continue; }
    if (inString) { if (c === "\\") { i += 2; continue; }
                    if (c === inString) { inString = null; i++; continue; } i++; continue; }
    if (inTpl)    { if (c === "\\") { i += 2; continue; }
                    if (c === "`") { inTpl--; i++; continue; }
                    if (c === "$" && c2 === "{") { inTpl++; i += 2; continue; } i++; continue; }
    if (c === "/" && c2 === "/") { inLine  = true;  i += 2; continue; }
    if (c === "/" && c2 === "*") { inBlock = true;  i += 2; continue; }
    if (c === '"' || c === "'")  { inString = c;    i++;     continue; }
    if (c === "`")               { inTpl = 1;        i++;     continue; }
    if (c === "{") { depth++; i++; continue; }
    if (c === "}") { depth--; if (depth === 0) return [openIdx, i + 1]; i++; continue; }
    i++;
  }
  return [openIdx, text.length];
}

function findRoutes(text) {
  const routes = [];
  const re = new RegExp(ROUTE_CALL_RE.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    let i = m.index + m[0].length;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    const sm = STRING_RE.exec(text.slice(i));
    if (!sm) continue;
    let j = i + sm[0].length;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== ",") continue;     // 1-arg form: handler only
    j++;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== "{") continue;
    const [optStart, optEnd] = matchBrace(text, j);
    const line = (text.slice(0, m.index).match(/\n/g) || []).length + 1;
    routes.push({ verb: m[1], path: sm[2], optStart, optEnd, line });
  }
  return routes;
}

function findSchemaBlock(text, optStart, optEnd) {
  const body = text.slice(optStart + 1, optEnd - 1);
  const re = new RegExp(SCHEMA_KEY_RE.source, "g");
  let m;
  while ((m = re.exec(body)) !== null) {
    let i = m.index + m[0].length;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] === "{") {
      const absOpen = optStart + 1 + i;
      return [absOpen, matchBrace(text, absOpen)[1]];
    }
    return null;     // schema is an identifier, not an inspectable literal
  }
  return null;
}

function inspectSchema(text, sStart, sEnd) {
  const body = text.slice(sStart + 1, sEnd - 1);
  return {
    summary:     STRING_FIELD_RE("summary").exec(body)?.[2] ?? null,
    operationId: STRING_FIELD_RE("operationId").exec(body)?.[2] ?? null,
    hasTags:     Boolean(STRING_FIELD_RE("tags").exec(body) || /\btags\s*:\s*\[/.exec(body)),
  };
}

function fullPathFor(file, routePath) {
  const rel = relative(API_SRC, file).split(sep).join("/");
  const parts = rel.split("/");
  const idx = parts.indexOf("routes");
  let prefix = "/";
  if (idx >= 0) {
    const dir = parts.slice(0, idx);
    const after = parts.slice(idx + 1, -1);
    prefix = dir[0] === "plugins" && dir[1] === "modules"
      ? "/api/modules/" + dir[2] + "/" + after.join("/")
      : "/" + after.join("/");
  }
  let p = prefix === "/" ? "" : prefix;
  if (routePath) p += routePath.startsWith("/") ? routePath : "/" + routePath;
  return p.replace(/\/+/g, "/");
}

function checkFile(file, text) {
  const out = [];
  for (const r of findRoutes(text)) {
    const fullPath = fullPathFor(file, r.path);
    const options = text.slice(r.optStart + 1, r.optEnd - 1);
    if (!/\baccess\s*:/.test(options)) {
      out.push({ line: r.line, msg: `[${r.verb.toUpperCase()} ${fullPath}] missing explicit access policy` });
    }
    const whitelisted = WHITELIST.has(fullPath);
    const schema = findSchemaBlock(text, r.optStart, r.optEnd);
    if (!schema) {
      out.push({ line: r.line, msg: `[${r.verb.toUpperCase()} ${fullPath}] missing schema block` });
      continue;
    }
    if (whitelisted) continue;
    const info = inspectSchema(text, schema[0], schema[1]);
    if (!info.summary)     out.push({ line: r.line, msg: `[${r.verb.toUpperCase()} ${fullPath}] missing schema.summary` });
    if (!info.operationId) out.push({ line: r.line, msg: `[${r.verb.toUpperCase()} ${fullPath}] missing schema.operationId` });
    if (!info.hasTags)     out.push({ line: r.line, msg: `[${r.verb.toUpperCase()} ${fullPath}] missing schema.tags` });
  }
  return out;
}

function main() {
  // Core uses `routes/api/v1/...`; legacy plugin modules (e.g. hello) do
  // too, but current portal/shop modules register under `routes/v1/...`
  // because the autoload prefix `api/modules/<name>` already supplies the
  // `api/` segment.  Accept both.
  const files = listRouteFiles(API_SRC).filter((f) =>
    /\/routes\/(api\/|v1\/)/.test("/" + relative(API_SRC, f).split(sep).join("/"))
  );
  const violations = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (LEGACY_ROUTE_CALL_RE.test(text)) {
      violations.push({ file, line: 1, msg: 'business routes must use createRouteRegistrar, not fastify.get/post/etc.' });
    }
    if (!ROUTE_CALL_RE.test(text)) continue;
    for (const v of checkFile(file, text)) violations.push({ file, ...v });
  }
  if (violations.length === 0) {
    console.log("[arch:routes] PASS 0 violation(s)");
    process.exit(0);
  }
  console.log(`[arch:routes] FAIL ${violations.length} violation(s):`);
  for (const v of violations) {
    const rel = relative(ROOT, v.file).split(sep).join("/");
    console.log(`  ${rel}:${v.line}:1 — ${v.msg}`);
  }
  process.exit(1);
}

main();
