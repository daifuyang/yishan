#!/usr/bin/env node
/**
 * compare-crm-schema-vs-db.mjs
 *
 * 比对 apps/yishan-api/src/modules/crm/db/schema.ts 声明的列 vs 实际 MySQL 列，
 * 输出每张表的 missing columns / extra columns。
 *
 * 用法：node apps/yishan-api/scripts/compare-crm-schema-vs-db.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', 'src', 'modules', 'crm', 'db', 'schema.ts');
const DOCKER_CONTAINER = process.env.LOCAL_MYSQL_CONTAINER ?? 'mysql-local';
const DB = process.env.LOCAL_MYSQL_DB ?? 'yishan';
const PWD = process.env.LOCAL_MYSQL_PWD ?? 'dev-root-only-do-not-use-in-prod';

const sqlOut = (q) =>
  execFileSync(
    'docker',
    ['exec', DOCKER_CONTAINER, 'mysql', '-uroot', `-p${PWD}`, '-N', '-B', DB, '-e', q],
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

// 1. 解析 schema.ts：拿到每个表名 + 列名（按 mysqlTable 块切分）
const src = readFileSync(SCHEMA_PATH, 'utf8');
const tables = [];
const re = /export const (\w+) = mysqlTable\(\s*'([^']+)'/g;
let m;
while ((m = re.exec(src))) {
  const [, varName, tableName] = m;
  const start = m.index;
  // 找到这一段的结束 —— 后续 mysqlTable 的位置 或文件末尾
  const rest = src.slice(start + 1);
  const nextMatch = /export const \w+ = mysqlTable\(/.exec(rest);
  const end = nextMatch ? start + 1 + nextMatch.index : src.length;
  const block = src.slice(start, end);
  const cols = [];
  // 匹配 "<camelName>: <someType>('<snake_name>'[, ...])" 或 "<camelName>: <someType>(...)"
  const colRe = /^\s*(\w+):\s*(?:bigint|varchar|datetime|int|json|tinyint|boolean|text|float|double|decimal)\s*\(([^)]*)\)/gm;
  let cm;
  while ((cm = colRe.exec(block))) {
    const [, jsName, args] = cm;
    const snakeMatch = args.match(/'([^']+)'/);
    const colName = snakeMatch ? snakeMatch[1] : jsName;
    cols.push(colName);
  }
  tables.push({ varName, tableName, cols });
}

// 2. 拉 DB 里 crm_* 表的实际列名
const dbRows = sqlOut(
  `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA='${DB}' AND TABLE_NAME LIKE 'crm\\\\_%' ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
);

const dbColsByTable = new Map();
for (const row of dbRows) {
  const [tableName, colName] = row.split('\t');
  if (!dbColsByTable.has(tableName)) dbColsByTable.set(tableName, new Set());
  dbColsByTable.get(tableName).add(colName);
}

// 3. 输出 diff
const allTables = new Set([
  ...tables.map((t) => t.tableName),
  ...dbColsByTable.keys(),
]);
const sorted = [...allTables].sort();

console.log(`Schema files declare ${tables.length} crm_* tables; DB has ${dbColsByTable.size}.\n`);

for (const t of sorted) {
  const decl = tables.find((x) => x.tableName === t);
  const dbCols = dbColsByTable.get(t) ?? new Set();
  if (!decl) {
    console.log(`[DB-only] ${t} (extra in DB, not declared in schema.ts)`);
    continue;
  }
  if (dbCols.size === 0) {
    console.log(`[MISSING-TABLE] ${t} declared in schema.ts, NOT in DB`);
    continue;
  }
  const declSet = new Set(decl.cols);
  const missing = decl.cols.filter((c) => !dbCols.has(c));
  const extra = [...dbCols].filter((c) => !declSet.has(c));
  if (missing.length === 0 && extra.length === 0) {
    console.log(`[OK] ${t} (${decl.cols.length} cols, no diff)`);
  } else {
    console.log(`[DIFF] ${t}`);
    if (missing.length) console.log(`  missing in DB: ${missing.join(', ')}`);
    if (extra.length) console.log(`  extra in DB  : ${extra.join(', ')}`);
  }
}