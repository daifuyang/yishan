#!/usr/bin/env node
/**
 * onboard-missing-crm-migrations.mjs
 *
 * 把 crm 模块在 drizzle journal 里声明、但 sys_module_migration 里没登记的
 * migration 灌进本地 MySQL（mysql-local），并补登记。
 *
 * 为什么需要：
 *   - on-board 流程（pnpm db:seed → Step 2/2 spawnOnboard）通过 drizzle-kit migrate
 *     跑模块迁移。drizzle-kit 0.31 在 Windows + meta 缺失 / mysql2 时序上有
 *     已知问题（见 chore(dev) "Windows / drizzle-kit 兼容修复"），可能跳过某些模块。
 *   - 结果：CRM 模块的 0000_init / 0001_* 没灌进 DB，但代码里 customer.repository
 *     已经在引用 crm_customer_member，list 接口会 500。
 *   - 本脚本绕开 drizzle-kit，直接 docker exec 灌 SQL，并把缺失的 tag
 *     补登记到 sys_module_migration。
 *
 * 幂等：
 *   - 已灌过的 tag 不会重复执行（按 sys_module_migration 查重）。
 *   - 表已经存在但 sys_module_migration 没登记的场景：检测到 "already exists"
 *     错误后仍登记 tag，避免下次又被卡住。
 *
 * 用法（在 repo 根目录）：
 *   node apps/yishan-api/scripts/onboard-missing-crm-migrations.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const MODULE_ID = 'crm';
const MODULE_DIR = join(APP_ROOT, 'src', 'modules', MODULE_ID);
const JOURNAL_PATH = join(MODULE_DIR, 'drizzle', 'meta', '_journal.json');
const DRIZZLE_DIR = join(MODULE_DIR, 'drizzle');

const MYSQL_CONTAINER = process.env.LOCAL_MYSQL_CONTAINER ?? 'mysql-local';
const MYSQL_PWD = process.env.LOCAL_MYSQL_PWD ?? 'dev-root-only-do-not-use-in-prod';
const DB = process.env.LOCAL_MYSQL_DB ?? 'yishan';

const log = (msg) => console.log(`[${MODULE_ID}] ${msg}`);

if (!existsSync(JOURNAL_PATH)) {
  console.error(`journal 不存在：${JOURNAL_PATH}`);
  process.exit(2);
}

// 读 journal：列出本模块所有预期 migration tag
const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
const tags = journal.entries.map((e) => e.tag);
log(`journal has ${tags.length} entries: ${tags.join(', ')}`);

// 查 sys_module_migration，看哪些已登记
const appliedRows = execFileSync(
  'docker',
  [
    'exec', MYSQL_CONTAINER, 'mysql',
    '-uroot', `-p${MYSQL_PWD}`, '-N', '-B', DB,
    '-e', `SELECT hash FROM sys_module_migration WHERE module_id='${MODULE_ID}';`,
  ],
  { encoding: 'utf8' },
)
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
const applied = new Set(appliedRows);
log(`already applied: ${[...applied].join(', ') || '(none)'}`);

const missing = tags.filter((t) => !applied.has(t));
if (missing.length === 0) {
  log('nothing to do.');
  process.exit(0);
}
log(`applying: ${missing.join(', ')}`);

function applySqlFile(file) {
  const sql = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    // 整行去掉(独立行) + 行尾/行内附加 marker 也要剥除
    .map((line) => line.replace(/-->\s*statement-breakpoint.*$/, '').trimEnd())
    .filter((line) => !/^-->\s*statement-breakpoint\s*$/.test(line))
    .join('\n');
  try {
    execFileSync(
      'docker',
      [
        'exec', '-i', MYSQL_CONTAINER, 'mysql',
        '-uroot', `-p${MYSQL_PWD}`, '--comments', DB,
      ],
      {
        input: sql,
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    return { ok: true };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    return { ok: false, message: stderr + stdout };
  }
}

function recordMigration(tag) {
  execFileSync(
    'docker',
    [
      'exec', MYSQL_CONTAINER, 'mysql',
      '-uroot', `-p${MYSQL_PWD}`, DB,
      '-e',
      `INSERT IGNORE INTO sys_module_migration (module_id, hash) VALUES ('${MODULE_ID}','${tag}');`,
    ],
    { stdio: 'inherit' },
  );
}

let appliedCount = 0;
let alreadyExistsCount = 0;
let failedCount = 0;
for (const tag of missing) {
  const sqlFile = join(DRIZZLE_DIR, `${tag}.sql`);
  if (!existsSync(sqlFile)) {
    console.error(`${tag}: SQL file missing at ${sqlFile}, skipping record.`);
    failedCount += 1;
    continue;
  }
  const result = applySqlFile(sqlFile);
  if (result.ok) {
    log(`${tag}: applied OK`);
    appliedCount += 1;
  } else {
    // 兼容"已经存在"：表已建但 sys_module_migration 没登记。
    if (/already exists|duplicate column name/i.test(result.message)) {
      log(`${tag}: tables/columns already exist, marking as applied`);
      alreadyExistsCount += 1;
    } else {
      console.error(`${tag}: FAILED\n${result.message}`);
      failedCount += 1;
      continue;
    }
  }
  recordMigration(tag);
}

log(`done. applied=${appliedCount} alreadyExisted=${alreadyExistsCount} failed=${failedCount}`);
process.exit(failedCount > 0 ? 1 : 0);