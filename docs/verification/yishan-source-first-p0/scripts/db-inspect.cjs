// Read-only inspection of a temporary P0 database.
// Usage: node db-inspect.cjs <mysql-url> <api-root>
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , url, apiRoot] = process.argv;
const req = createRequire(path.join(apiRoot, 'package.json'));
const mysql = req('mysql2/promise');

// Same hashing as drizzle-orm migrator.readMigrationFiles: sha256(full file content)
function journalHashes() {
  const out = {};
  const sources = [['core', path.join(apiRoot, 'drizzle')]];
  const modRoot = path.join(apiRoot, 'src', 'modules');
  for (const id of fs.readdirSync(modRoot)) sources.push([id, path.join(modRoot, id, 'drizzle')]);
  for (const [owner, dir] of sources) {
    const jp = path.join(dir, 'meta', '_journal.json');
    if (!fs.existsSync(jp)) continue;
    const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
    for (const e of j.entries) {
      const f = path.join(dir, `${e.tag}.sql`);
      if (!fs.existsSync(f)) { out[`missing:${owner}/${e.tag}`] = `${owner}/${e.tag} (SQL FILE MISSING)`; continue; }
      const h = crypto.createHash('sha256').update(fs.readFileSync(f).toString()).digest('hex');
      out[h] = `${owner}/${e.tag} when=${e.when} (${new Date(e.when).toISOString()})`;
    }
  }
  return out;
}

(async () => {
  const conn = await mysql.createConnection(url);
  const known = journalHashes();
  const [tables] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name');
  const names = tables.map((r) => r.t);
  const groups = {};
  for (const n of names) { const p = n.startsWith('__') ? '__meta' : n.split('_')[0]; (groups[p] ||= []).push(n); }
  console.log(`## tables (${names.length})`);
  for (const [g, ts] of Object.entries(groups)) console.log(`  ${g}: ${ts.length} -> ${ts.join(', ')}`);
  if (names.includes('__drizzle_migrations')) {
    const [cols] = await conn.query("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='__drizzle_migrations' ORDER BY ordinal_position");
    console.log(`## __drizzle_migrations columns: ${cols.map((c) => c.c).join(', ')}`);
    const [rows] = await conn.query('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id');
    console.log(`## __drizzle_migrations rows (${rows.length})`);
    for (const r of rows) console.log(`  id=${r.id} created_at=${r.created_at} (${new Date(Number(r.created_at)).toISOString()}) hash=${r.hash.slice(0, 12)}… -> ${known[r.hash] ?? 'UNKNOWN HASH'}`);
  } else console.log('## __drizzle_migrations: ABSENT');
  for (const t of ['sys_module_migration', 'sys_module']) {
    if (!names.includes(t)) { console.log(`## ${t}: ABSENT`); continue; }
    const [rows] = await conn.query(`SELECT * FROM ${t} ORDER BY id`);
    console.log(`## ${t} rows (${rows.length})`);
    for (const r of rows) {
      const o = { ...r }; for (const k of Object.keys(o)) if (o[k] instanceof Date) delete o[k];
      console.log('  ' + JSON.stringify(o));
    }
  }
  await conn.end();
})().catch((e) => { console.error('INSPECT ERROR', e.message); process.exit(1); });
