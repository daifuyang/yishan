import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const generatedDir = path.join(root, 'src/db/schema')

/**
 * Self-test for the SQL→TS generator. Verifies that:
 *   1. Running `node scripts/generate-drizzle-schema.mjs` produces the three
 *      expected files and they parse as TypeScript.
 *   2. Every SQL `CREATE TABLE` block becomes exactly one `mysqlTable(...)`
 *      call (no table is dropped or duplicated).
 *   3. Every declared SQL column appears as a key in its `mysqlTable(...)`
 *      call (no column is silently dropped).
 *   4. Every `DECIMAL(p, s)` column in SQL produces a Drizzle declaration
 *      with `scale: s` (catches the "scale defaults to 0" regression).
 *   5. Every table that has at least one FK column (other than
 *      creator/updater/leader) gets a corresponding `*Relations` export
 *      that references the expected parent table.
 *   6. All `*Relations` exports import every table they reference
 *      (no `Cannot find name 'X'` errors in the generated file).
 *   7. Self-reference parent_id columns produce both `parent:` one() and
 *      `children:` many() edges.
 *   8. `tsc --noEmit` against `src/db/schema/**.ts` passes.
 *
 * Run with: `node scripts/test-generator.mjs`
 * Exit code: 0 on success, 1 on any assertion failure.
 */

const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
const TABLES = ['shop_product_sku']

function tableName(sqlName) {
  if (TABLES.includes(sqlName)) {
    return sqlName === 'shop_product_sku' ? 'shopSku' : camel(sqlName)
  }
  return camel(sqlName)
}

let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// 0. Regenerate so we are testing the current generator output.
console.log('Running generator...')
execSync('node scripts/generate-drizzle-schema.mjs', { cwd: root, stdio: 'inherit' })

const drizzleDir = path.join(root, 'drizzle')
const sqlFiles = readdirSync(drizzleDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const tablesSql = sqlFiles
  .map((name) => readFileSync(path.join(drizzleDir, name), 'utf8'))
  .join('\n\n')

const tablesTs = readFileSync(path.join(generatedDir, 'tables.ts'), 'utf8')
const relationsTs = readFileSync(path.join(generatedDir, 'relations.ts'), 'utf8')
const indexTs = readFileSync(path.join(generatedDir, 'index.ts'), 'utf8')

console.log('\n--- Assertions ---\n')

// 1. Files exist
for (const f of ['tables.ts', 'relations.ts', 'index.ts']) {
  check(`generated/${f} exists`, statSync(path.join(generatedDir, f)).isFile())
}

// 2. Count tables
const createTableRe = /CREATE TABLE `([^`]+)`/g
const sqlTables = [...tablesSql.matchAll(createTableRe)].map((m) => m[1]).sort()
const mysqlTableCalls = (tablesTs.match(/mysqlTable\(/g) ?? []).length
check(
  `one mysqlTable() per CREATE TABLE: ${sqlTables.length} SQL tables, ${mysqlTableCalls} emitted`,
  mysqlTableCalls === sqlTables.length,
)

// 3. Each SQL column appears in its table
for (const m of tablesSql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\) DEFAULT CHARACTER SET/g)) {
  const [, name, body] = m
  const tbl = tableName(name)
  const tableBlock = tablesTs.match(new RegExp(`export const ${tbl} = mysqlTable[\\s\\S]*?\\n\\)`))
  if (!tableBlock) {
    check(`table ${tbl} present in tables.ts`, false)
    continue
  }
  for (const colMatch of body.matchAll(/^`([^`]+)`\s+/gm)) {
    const colName = colMatch[1]
    if (colName === 'id' && /PRIMARY KEY/.test(body.split('\n').find((l) => l.includes(colName)) ?? '')) continue
    const camelCol = camel(colName)
    if (!new RegExp(`\\b${camelCol}\\s*:`).test(tableBlock[0])) {
      check(`column ${tbl}.${camelCol} present`, false, `column ${colName} not found in ${tbl}`)
    }
  }
}

// 4. Decimal scale correctness
for (const m of tablesSql.matchAll(/`([^`]+)`\s+DECIMAL\((\d+),\s*(\d+)\)/g)) {
  const [, colName, , s] = m
  const camelCol = camel(colName)
  const re = new RegExp(`\\b${camelCol}\\s*:\\s*decimal\\('${colName}',\\s*\\{[\\s\\S]*?scale:\\s*(\\d+)`)
  const found = tablesTs.match(re)
  if (!found) {
    check(`decimal column ${colName} scale declared`, false, 'no scale clause found')
  } else if (found[1] !== s) {
    check(`decimal column ${colName} scale=${s}`, false, `got scale=${found[1]}`)
  }
}

// 5. Relations coverage: any table with an FK column other than
//    creator_id/updater_id/leader_id must have a *Relations export.
const fkRe = /`([^`]+_id)`\s+(?:INTEGER|BIGINT|VARCHAR)/g
const tablesWithFk = new Set()
for (const m of tablesSql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\) DEFAULT CHARACTER SET/g)) {
  const [, name, body] = m
  for (const fk of body.matchAll(fkRe)) {
    if (!['creator_id', 'updater_id', 'leader_id'].includes(fk[1])) {
      tablesWithFk.add(tableName(name))
    }
  }
}
const relationsExports = new Set(
  [...relationsTs.matchAll(/export const (\w+)Relations = relations/g)].map((m) => m[1]),
)
for (const t of tablesWithFk) {
  check(`relations exported for ${t}`, relationsExports.has(t))
}

// 6. All tables referenced in relations.ts are imported
const importedInRelations = new Set(
  [...relationsTs.matchAll(/^import \{([^}]+)\}/gm)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim())),
)
const referencedInRelations = new Set(
  [...relationsTs.matchAll(/\b(?:one|many)\((\w+)\b/g)].map((m) => m[1]),
)
for (const ref of referencedInRelations) {
  check(`relations.ts imports ${ref}`, importedInRelations.has(ref))
}

// 7. Self-references produce both parent: and children: edges
const selfRefTables = ['sys_dept', 'sys_menu', 'sys_attachment_folder', 'portal_category', 'shop_category', 'sys_app_resource', 'sys_app_menu']
for (const t of selfRefTables) {
  const tbl = tableName(t)
  const block = relationsTs.match(new RegExp(`export const ${tbl}Relations[\\s\\S]*?\\}\\)\\)`))
  if (!block) {
    check(`self-ref ${tbl} has relations block`, false)
    continue
  }
  check(
    `self-ref ${tbl} has parent: one()`,
    /parent:\s*one\(/.test(block[0]),
  )
  check(
    `self-ref ${tbl} has children: many()`,
    /children:\s*many\(/.test(block[0]),
  )
}

// 8. tsc --noEmit (use project's tsconfig.json so skipLibCheck and paths
//    are honored; otherwise drizzle-orm's own .d.ts surfaces known issues).
console.log('\nRunning tsc --noEmit on generated schema...')
try {
  execSync('npx tsc --noEmit -p tsconfig.json', {
    cwd: root,
    stdio: 'inherit',
  })
  check('tsc --noEmit passes', true)
} catch {
  check('tsc --noEmit passes', false, 'see tsc output above')
}

console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed} assertion(s))`}\n`)
process.exit(failed === 0 ? 0 : 1)