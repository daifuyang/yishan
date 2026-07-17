#!/usr/bin/env node
/**
 * Plugin manifest sanity check.
 *
 * Scans plugin manifest files under
 *   apps/yishan-api/src/plugins/modules/<plugin>/manifest.ts
 * and enforces:
 *
 *   M1 — `pluginId` matches `^[\w-]+/[\w-]+$`
 *   M2 — every manifest's `pluginId` is unique
 *   M3 — `name` equals the directory name
 *   M4 — `version` matches semver `^\d+\.\d+\.\d+`
 *   M5 — `routeBase` starts with `/api/`
 *   M6 — every manifest's `routeBase` is unique
 *   M7 — `coreCompatibility` is a non-empty string
 *   M8 — every menu.perm is listed in `permissions`
 *   M9 — every menu.channel is listed in `channels`
 *  M10 — menu.path values are unique within a manifest
 *  M11 — permissions is required, must be array, no legacy string[] format
 *
 * Implementation: pure RegExp + brace counter.  The manifest body is the
 * first balanced `{ ... }` inside `export default { ... } as const`.  A
 * small tokenizer then parses string literals, arrays, and nested objects
 * so menu entries can be validated.  No tsx/Node import is needed.
 *
 * Exit codes: 0 = clean, 1 = violations found.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const API_SRC = join(ROOT, "apps", "yishan-api", "src");
const MODULES_DIR = join(API_SRC, "plugins", "modules");
const MANIFESTS = existsSync(MODULES_DIR)
  ? readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(MODULES_DIR, entry.name, "manifest.ts")))
      .map((entry) => `plugins/modules/${entry.name}/manifest.ts`)
  : [];

const PLUGIN_ID_RE = /^[\w-]+\/[\w-]+$/;
const DB_NAMESPACE_RE = /^[a-z][a-z0-9_]{2,23}$/;
const VERSION_RE = /^\d+\.\d+\.\d+/;
const STRING_RE = /^(['"])((?:\\.|(?!\1).)*)\1/;
const KEY_RE = /^\s*([A-Za-z_$][\w$]*)\s*:\s*/;

// Balanced pair finder.  Honors strings, comments, and template literals.
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
      else i++;
    }
  }
  return out;
}

function parseManifest(text) {
  const m = /export\s+default\s*\{/.exec(text);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const end = findPair(text, open, "{", "}");
  return parseObject(text.slice(open + 1, end - 1));
}

/**
 * Sentinel values that must not appear in manifest permissions.
 */
const FORBIDDEN_SENTINELS = ['*', '__super_admin__'];

/**
 * Parse permissions array with strict validation.
 * Returns { codes, errors } where errors contains all validation failures.
 *
 * 新方案要求：
 * - permissions 字段必须存在
 * - 必须是非空数组
 * - 只支持结构化对象格式 { code, label, ... }，不接受字符串数组
 */
function parsePermissions(permissionsObj) {
  const result = { codes: [], errors: [] };

  // permissions 字段必须存在且是数组
  if (!permissionsObj) {
    result.errors.push('permissions is required and must be an array of structured permission objects');
    return result;
  }
  if (permissionsObj.kind !== "array") {
    result.errors.push('permissions must be an array of structured permission objects');
    return result;
  }

  const seenCodes = new Set();

  for (let i = 0; i < permissionsObj.value.length; i++) {
    const item = permissionsObj.value[i];

    // 拒绝旧格式字符串
    if (item.kind !== "object") {
      result.errors.push(`permissions[${i}] must be an object, not a string. Use { code, label, ... } format.`);
      continue;
    }

    const perm = item.value;

    // 校验 code 是非空字符串
    const codeField = perm?.code;
    if (!codeField || codeField.kind !== "string" || !codeField.value.trim()) {
      result.errors.push(`permissions[${i}].code must be a non-empty string`);
      continue;
    }
    const code = codeField.value.trim();

    // 拒绝 sentinel 值
    if (FORBIDDEN_SENTINELS.includes(code)) {
      result.errors.push(`permissions[${i}].code '${code}' is a reserved sentinel and cannot be used in manifest`);
      continue;
    }

    // 校验 label 是非空字符串
    const labelField = perm?.label;
    if (!labelField || labelField.kind !== "string" || !labelField.value.trim()) {
      result.errors.push(`permissions[${i}].label must be a non-empty string`);
      continue;
    }

    // 校验 description 若存在则是非空字符串
    const descField = perm?.description;
    if (descField && (descField.kind !== "string" || !descField.value.trim())) {
      result.errors.push(`permissions[${i}].description must be a non-empty string when provided`);
    }

    // 校验 group 若存在则是非空字符串
    const groupField = perm?.group;
    if (groupField && (groupField.kind !== "string" || !groupField.value.trim())) {
      result.errors.push(`permissions[${i}].group must be a non-empty string when provided`);
    }

    // 检测同一 manifest 内 code 重复
    if (seenCodes.has(code)) {
      result.errors.push(`permissions: duplicate code '${code}' in manifest`);
    } else {
      seenCodes.add(code);
      result.codes.push(code);
    }
  }

  return result;
}

/**
 * Parse string array (used for channels).
 */
function asStringArray(v) {
  if (!v || v.kind !== "array" || !v.value.every((x) => x.kind === "string")) return null;
  return v.value.map((x) => x.value);
}

function checkManifest(file, obj, dirName, out) {
  const push = (rule, msg) => out.push({ file, line: 1, rule, msg });
  const s = (v) => v?.kind === "string" ? v.value : null;
  const pluginId = s(obj.pluginId), name = s(obj.name), version = s(obj.version);
  const routeBase = s(obj.routeBase), coreCompat = s(obj.coreCompatibility), dbNamespace = s(obj.dbNamespace);
  if (!pluginId) push("M1", "manifest missing pluginId");
  else if (!PLUGIN_ID_RE.test(pluginId)) push("M1", `pluginId '${pluginId}' does not match ^[\w-]+/[\w-]+$`);
  if (name !== dirName) push("M3", `name must equal directory name '${dirName}' (got '${name ?? "?"}')`);
  if (!version || !VERSION_RE.test(version)) push("M4", `version '${version ?? "?"}' does not match semver ^\\d+\\.\\d+\\.\\d+`);
  if (!routeBase || !routeBase.startsWith("/api/")) push("M5", `routeBase '${routeBase ?? "?"}' must start with /api/`);
  if (!coreCompat) push("M7", "coreCompatibility must be a non-empty string");
  if (!dbNamespace || !DB_NAMESPACE_RE.test(dbNamespace)) push("M12", "dbNamespace must match ^[a-z][a-z0-9_]{2,23}$");

  // 新方案：无条件校验 permissions 格式，拒绝旧格式 string[]
  const { codes, errors } = parsePermissions(obj.permissions);
  for (const message of errors) {
    push("M11", message);
  }

  if (obj.menus && obj.menus.kind === "array") {
    const channels = new Set(asStringArray(obj.channels) ?? []);
    const seenPaths = new Map();
    obj.menus.value.forEach((m, idx) => {
      if (m.kind !== "object") return;
      const o = m.value;
      if (o.perm?.kind === "string" && !codes.includes(o.perm.value)) {
        push("M8", `menus[${idx}].perm '${o.perm.value}' is not in permissions`);
      }
      if (o.channel?.kind === "string" && !channels.has(o.channel.value)) {
        push("M9", `menus[${idx}].channel '${o.channel.value}' is not in channels`);
      }
      if (o.path?.kind === "string") {
        const p = o.path.value;
        if (seenPaths.has(p)) push("M10", `menus[${idx}].path '${p}' duplicates menus[${seenPaths.get(p)}].path`);
        else seenPaths.set(p, idx);
      }
    });
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
  const parsed = MANIFESTS.map((rel) => {
    const file = join(API_SRC, rel);
    const obj = parseManifest(readFileSync(file, "utf8"));
    return { file, obj, dirName: rel.split("/")[2], violations: [] };
  });
  for (const p of parsed) {
    if (!p.obj) { p.violations.push({ file: p.file, line: 1, rule: "M0", msg: "could not parse manifest body" }); continue; }
    checkManifest(p.file, p.obj, p.dirName, p.violations);
  }
  const withObj = parsed.filter((q) => q.obj);
  checkUniqueness(withObj, (o) => o.pluginId?.value, "M2", "pluginId");
  checkUniqueness(withObj, (o) => o.routeBase?.value, "M6", "routeBase");
  const violations = parsed.flatMap((p) => p.violations);
  if (violations.length === 0) {
    console.log("[arch:manifest] PASS 0 violation(s)");
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
