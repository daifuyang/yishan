import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const coreMigrations = readdirSync(path.join(root, 'drizzle'))
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => ({ id: `core/${file}`, path: path.join(root, 'drizzle', file) }))
const pluginsRoot = path.join(root, 'src/plugins/modules')
const pluginMigrations = (existsSync(pluginsRoot) ? readdirSync(pluginsRoot, { withFileTypes: true }) : [])
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const moduleRoot = path.join(pluginsRoot, entry.name)
    const migrationsDir = path.join(moduleRoot, 'migrations')
    if (!existsSync(migrationsDir)) return []
    const manifest = readFileSync(path.join(moduleRoot, 'manifest.ts'), 'utf8')
    const namespace = manifest.match(/dbNamespace:\s*['\"]([a-z][a-z0-9_]{2,23})['\"]/)?.[1]
    if (!namespace) throw new Error(`Plugin manifest must declare dbNamespace: ${path.join(moduleRoot, 'manifest.ts')}`)
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.endsWith('.sql'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((file) => ({ id: `${entry.name}/${file.name}`, path: path.join(migrationsDir, file.name), namespace }))
  })

function validatePluginMigration(migration) {
  if (!migration.namespace) return
  const sql = readFileSync(migration.path, 'utf8')
  const objectNames = [...sql.matchAll(/(?:CREATE TABLE|ALTER TABLE|DROP TABLE)\s+`?([a-z0-9_]+)`?/gi)].map((match) => match[1])
  const indexNames = [...sql.matchAll(/(?:UNIQUE\s+)?INDEX\s+`?([a-z0-9_]+)`?/gi)].map((match) => match[1])
  const namespace = migration.namespace
  if (objectNames.some((name) => !name.startsWith(`${namespace}_`))) {
    throw new Error(`Plugin migration ${migration.id} contains an object outside ${namespace}_*`)
  }
  if (indexNames.some((name) => !name.startsWith(namespace) && !name.startsWith(`idx_${namespace}_`) && !name.startsWith(`uniq_${namespace}_`))) {
    throw new Error(`Plugin migration ${migration.id} contains an index outside ${namespace}`)
  }
}

pluginMigrations.forEach(validatePluginMigration)
const migrations = [...coreMigrations, ...pluginMigrations]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((migration) => readFileSync(migration.path, 'utf8'))
  .join('\n\n')

const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

/**
 * Map SQL table names to TS export names. Most are just snake→camel, but a few
 * legacy names diverge (e.g. shop_product_sku → shopSku to match consumer code).
 */
const TABLE_NAME_ALIAS = {
  shop_product_sku: 'shopSku',
}

const tableName = (sqlName) => TABLE_NAME_ALIAS[sqlName] ?? camel(sqlName)

/**
 * Split the CREATE TABLE block into the header and the body.
 */
function extractTableBlocks(sql) {
  const re = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) DEFAULT CHARACTER SET/g
  const blocks = []
  for (const m of sql.matchAll(re)) {
    const [, name, body] = m
    blocks.push({ name, body })
  }
  return blocks
}

/**
 * Read one column line (e.g. `` `price` DECIMAL(10, 2) NOT NULL DEFAULT 0``).
 * Returns { name, sqlType, attrs } or null if not a column line.
 *
 * Walks the type token char-by-char so parens containing commas (DECIMAL(10, 2))
 * do not cause early termination at the inner comma.
 */
function parseColumnLine(line) {
  const head = line.match(/^`([^`]+)`\s+/)
  if (!head) return null
  const name = head[1]
  const rest = line.slice(head[0].length)
  let i = 0
  let depth = 0
  while (i < rest.length) {
    const ch = rest[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0 && (ch === ' ' || ch === '\t' || ch === ',')) break
    i++
  }
  const sqlType = rest.slice(0, i).trim()
  const attrs = rest.slice(i).trim()
  return { name, sqlType, attrs }
}

/**
 * Parse the body of a CREATE TABLE into columns and (unique)indexes.
 */
function parseTableBody(body) {
  const primary = body.match(/PRIMARY KEY \(`([^`]+)`\)/)?.[1] ?? null
  const columns = []
  const indexes = []

  // SQL migrations may put several columns on one physical line. Split only
  // on top-level commas so VARCHAR/DECIMAL parameter lists stay intact.
  const definitions = []
  let start = 0
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++
    else if (body[i] === ')') depth--
    else if (body[i] === ',' && depth === 0) {
      definitions.push(body.slice(start, i))
      start = i + 1
    }
  }
  definitions.push(body.slice(start))

  for (const rawLine of definitions) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('PRIMARY KEY')) continue

    const indexMatch = line.match(/^(UNIQUE )?INDEX `([^`]+)`\(([^)]+)\)$/)
    if (indexMatch) {
      indexes.push({
        unique: !!indexMatch[1],
        name: indexMatch[2],
        columns: indexMatch[3].split(',').map((s) => s.trim().replace(/`/g, '')),
      })
      continue
    }

    const col = parseColumnLine(line)
    if (!col) continue

    const autoIncrement = /AUTO_INCREMENT/.test(col.attrs)
    const notNull = /NOT NULL/.test(col.attrs)
    let defaultValue = null
    const defaultMatch = col.attrs.match(/DEFAULT\s+(CURRENT_TIMESTAMP(?:\(\d\))?|true|false|-?\d+|'[^']*')/)
    if (defaultMatch) defaultValue = defaultMatch[1]

    columns.push({
      name: col.name,
      sqlType: col.sqlType,
      notNull,
      autoIncrement,
      default: defaultValue,
    })
  }

  return { primary, columns, indexes }
}

/**
 * Map an SQL type to a Drizzle column declaration.
 */
function columnType(name, sqlType) {
  const upper = sqlType.toUpperCase()
  if (upper.startsWith('VARCHAR') || upper.startsWith('CHAR')) {
    const m = sqlType.match(/\((\d+)\)/)
    return `varchar('${name}', { length: ${m?.[1] ?? 255} })`
  }
  if (upper.startsWith('TEXT')) return `text('${name}')`
  if (upper.startsWith('JSON')) return `json('${name}')`
  if (upper.startsWith('DATETIME')) return `datetime('${name}', { mode: 'date' })`
  if (upper.startsWith('TIMESTAMP')) return `timestamp('${name}', { mode: 'date' })`
  if (upper.startsWith('DATE')) return `date('${name}', { mode: 'date' })`
  if (upper.startsWith('DECIMAL')) {
    const m = sqlType.match(/\((\d+)\s*,\s*(\d+)\)/)
    if (!m) throw new Error(`Bad DECIMAL type: ${sqlType} for column ${name}`)
    return `decimal('${name}', { precision: ${m[1]}, scale: ${m[2]} })`
  }
  if (upper.startsWith('BIGINT')) return `bigint('${name}', { mode: 'number' })`
  if (upper.startsWith('BOOLEAN')) return `boolean('${name}')`
  if (upper.startsWith('TINYINT')) return `tinyint('${name}')`
  return `int('${name}')`
}

/**
 * Render a .default(...) clause for a DEFAULT <value> parsed from SQL.
 * Decimal columns only accept string or SQL defaults — coerce integer
 * literals to quoted strings so Drizzle's typings are satisfied.
 */
function renderDefault(colName, sqlType, defaultValue) {
  if (defaultValue === null) return ''
  if (defaultValue.startsWith('CURRENT_TIMESTAMP')) return `.default(sql\`${defaultValue}\`)`
  if (defaultValue === 'true') return '.default(true)'
  if (defaultValue === 'false') return '.default(false)'
  if (/^-?\d+$/.test(defaultValue)) {
    if (sqlType.toUpperCase().startsWith('DECIMAL')) return `.default('${defaultValue}')`
    return `.default(${defaultValue})`
  }
  // Quoted string literal already includes the quotes, safe to embed verbatim.
  return `.default(${defaultValue})`
}

/**
 * Build the relations edges. Each *_id column (except creator/updater/leader)
 * implies a one() relation from the child table to the inferred parent table.
 * A self-reference (child === parent) implies both one() parent and many() children.
 *
 * Returns edges: [{ child, fk, parent }]
 */
const FK_MAP = {
  user_id: 'sysUser',
  dept_id: 'sysDept',
  role_id: 'sysRole',
  menu_id: 'sysMenu',
  post_id: 'sysPost',
  type_id: 'sysDictType',
  folder_id: 'sysAttachmentFolder',
  attribute_id: 'shopAttribute',
  value_id: 'shopAttributeValue',
  product_id: 'shopProduct',
  sku_id: 'shopSku',
  address_id: 'shopAddress',
  order_id: 'shopOrder',
  template_id: 'portalTemplate',
  app_id: 'sysApp',
  resource_id: 'sysAppResource',
  article_id: 'portalArticle',
  plugin_id: 'sysPlugin',
  plugin_install_id: 'sysPluginInstall',
}

// Plugin schemas may reuse generic column names (for example status_id).
// Keep those associations scoped to their owning table so Core mappings do
// not leak business-plugin knowledge into unrelated tables.
const TABLE_FK_MAP = {
  iximei_crm_customer: { status_id: 'iximeiCrmCustomerStatus', owner_user_id: 'sysUser' },
  iximei_crm_customer_remark: { customer_id: 'iximeiCrmCustomer', user_id: 'sysUser' },
  iximei_crm_customer_browse: { customer_id: 'iximeiCrmCustomer', user_id: 'sysUser' },
  iximei_crm_dispatch: { customer_id: 'iximeiCrmCustomer', hospital_id: 'iximeiCrmHospital', status_id: 'iximeiCrmDispatchStatus' },
  iximei_crm_dispatch_reply: { dispatch_id: 'iximeiCrmDispatch', user_id: 'sysUser' },
  iximei_crm_dispatch_follow_log: { dispatch_id: 'iximeiCrmDispatch', user_id: 'sysUser' },
  iximei_crm_member_customer: { owner_user_id: 'sysUser' },
  iximei_crm_member_remark: { member_id: 'iximeiCrmMemberCustomer', user_id: 'sysUser' },
  iximei_crm_member_browse: { member_id: 'iximeiCrmMemberCustomer', user_id: 'sysUser' },
  iximei_crm_hospital_account: { hospital_id: 'iximeiCrmHospital', user_id: 'sysUser' },
}

// Map FK column name → consumer-facing relation key. When absent, the FK
// column name itself (camelCased) is used.
const RELATION_KEY_ALIAS = {
  creator_id: 'creator',
  updater_id: 'updater',
  leader_id: 'leader',
}

// Per-table semantic aliases for common business relations. These avoid
// collisions between scalar FK column names (for example productId: number)
// and nested relation objects (product: {...}) in Drizzle relational results.
const SEMANTIC_RELATION_ALIAS = {
  portalArticle: { templateId: 'template' },
  portalArticleCategory: { articleId: 'article', categoryId: 'category' },
  portalPage: { templateId: 'template' },
  shopAttributeValue: { attributeId: 'attribute' },
  shopProduct: { categoryId: 'category' },
  shopSku: { productId: 'product' },
  shopSkuAttribute: { skuId: 'sku', attributeId: 'attribute', valueId: 'value' },
  shopAddress: { userId: 'user' },
  shopCart: { userId: 'user', productId: 'product', skuId: 'sku' },
  shopOrder: { userId: 'user', addressId: 'address' },
  shopOrderItem: { orderId: 'order', productId: 'product', skuId: 'sku' },
  iximeiCrmCustomer: { statusId: 'status', ownerUserId: 'owner' },
  iximeiCrmCustomerRemark: { customerId: 'customer', userId: 'user' },
  iximeiCrmCustomerBrowse: { customerId: 'customer', userId: 'user' },
  iximeiCrmDispatch: { customerId: 'customer', hospitalId: 'hospital', statusId: 'status' },
  iximeiCrmDispatchReply: { dispatchId: 'dispatch', userId: 'user' },
  iximeiCrmDispatchFollowLog: { dispatchId: 'dispatch', userId: 'user' },
  iximeiCrmMemberCustomer: { ownerUserId: 'owner' },
  iximeiCrmMemberRemark: { memberId: 'member', userId: 'user' },
  iximeiCrmMemberBrowse: { memberId: 'member', userId: 'user' },
  iximeiCrmHospitalAccount: { hospitalId: 'hospital', userId: 'user' },
}
const SKIP_FOR_RELATIONS = new Set([])

function buildRelations(parsedTables) {
  const edges = []

  for (const t of parsedTables) {
    for (const col of t.columns) {
      if (SKIP_FOR_RELATIONS.has(col.name)) continue
      if (!col.name.endsWith('_id')) continue

      let parent = TABLE_FK_MAP[t.name]?.[col.name] ?? FK_MAP[col.name]
      // Disambiguate category_id by host-table prefix.
      if (col.name === 'category_id') {
        parent = t.name.startsWith('portal_') ? 'portalCategory' : 'shopCategory'
      }
      // creator_id / updater_id / leader_id all point at sysUser.
      if (col.name === 'creator_id' || col.name === 'updater_id' || col.name === 'leader_id') {
        parent = 'sysUser'
      }
      // Self-reference: parent_id whose host table is its own target.
      // Only apply when the column name itself indicates self-ref — do NOT
      // fall back to "child === parent" for creator_id/updater_id/etc., since
      // those can coincidentally point at the same table without being a
      // tree/parent structure.
      let isSelfRef = false
      if (col.name === 'parent_id') {
        parent = tableName(t.name)
        isSelfRef = true
      }
      if (!parent) continue

      edges.push({
        child: tableName(t.name),
        fk: camel(col.name),
        parent,
        isSelfRef,
      })
    }
  }

  return edges
}

// --- Generate tables.ts ---

const tableBlocks = extractTableBlocks(migrations)
const parsedTables = tableBlocks.map((b) => ({ name: b.name, ...parseTableBody(b.body) }))

// Track which Drizzle type constructors and helpers are actually used so the
// generated header imports only the symbols needed (keeps tsc strict-clean).
const usedTypes = new Set()
const usedHelpers = new Set(['mysqlTable'])

for (const t of parsedTables) {
  for (const col of t.columns) {
    const upper = col.sqlType.toUpperCase()
    if (upper.startsWith('VARCHAR') || upper.startsWith('CHAR')) usedTypes.add('varchar')
    else if (upper.startsWith('TEXT')) usedTypes.add('text')
    else if (upper.startsWith('JSON')) usedTypes.add('json')
    else if (upper.startsWith('DATETIME')) usedTypes.add('datetime')
    else if (upper.startsWith('TIMESTAMP')) usedTypes.add('timestamp')
    else if (upper.startsWith('DATE')) usedTypes.add('date')
    else if (upper.startsWith('DECIMAL')) usedTypes.add('decimal')
    else if (upper.startsWith('BIGINT')) usedTypes.add('bigint')
    else if (upper.startsWith('BOOLEAN')) usedTypes.add('boolean')
    else if (upper.startsWith('TINYINT')) usedTypes.add('tinyint')
    else usedTypes.add('int')
    if (col.default && col.default.startsWith('CURRENT_TIMESTAMP')) {
      // sql template tag is used; helper import tracked separately
    }
  }
  if (t.indexes.length > 0) {
    usedHelpers.add('index')
    usedHelpers.add('uniqueIndex')
  }
}

let tablesOutput = '// Generated from drizzle/*.sql. Do not edit manually.\n'
tablesOutput +=
  `import { ${Array.from(usedTypes).sort().join(', ')}, ${Array.from(usedHelpers).sort().join(', ')} } from 'drizzle-orm/mysql-core'\n`
if (parsedTables.some((t) => t.columns.some((c) => c.default && c.default.startsWith('CURRENT_TIMESTAMP')))) {
  tablesOutput += "import { sql } from 'drizzle-orm'\n"
}
tablesOutput += '\n'

for (const t of parsedTables) {
  const tbl = tableName(t.name)
  const columnLines = []
  for (const col of t.columns) {
    let def = columnType(col.name, col.sqlType)
    if (col.name === t.primary) def += '.primaryKey()'
    if (col.autoIncrement) def += '.autoincrement()'
    if (col.notNull) def += '.notNull()'
    def += renderDefault(col.name, col.sqlType, col.default)
    columnLines.push(`  ${camel(col.name)}: ${def},`)
  }
  const colsBlock = columnLines.join('\n')

  if (t.indexes.length > 0) {
    const indexLines = t.indexes
      .map((idx) => {
        const fields = idx.columns.map((c) => `t.${camel(c)}`).join(', ')
        const fn = idx.unique ? 'uniqueIndex' : 'index'
        return `    ${camel(idx.name)}: ${fn}('${idx.name}').on(${fields}),`
      })
      .join('\n')
    tablesOutput += `export const ${tbl} = mysqlTable(\n  '${t.name}',\n  {\n${colsBlock}\n  },\n  (t) => ({\n${indexLines}\n  })\n)\n\n`
  } else {
    tablesOutput += `export const ${tbl} = mysqlTable(\n  '${t.name}',\n  {\n${colsBlock}\n  }\n)\n\n`
  }
}

// --- Generate relations.ts ---

const edges = buildRelations(parsedTables)

// Aggregate edges per child table: every edge becomes a one() on the child and a many() on the parent.
const oneEdgesByTable = new Map()
const manyEdgesByTable = new Map()
const referencedTables = new Set()
function pushEdge(table, kind, line) {
  const map = kind === 'one' ? oneEdgesByTable : manyEdgesByTable
  if (!map.has(table)) map.set(table, [])
  map.get(table).push(line)
}

for (const e of edges) {
  const isSelf = e.isSelfRef
  const relName = `${e.child}_${e.fk}`
  // The snake_case FK column for `e.fk === 'creatorId'` is `creator_id`. Use
  // the alias map for the consumer-facing relation key; otherwise fall back
  // to the camelCased FK column name.
  const snakeFk = e.fk.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^_/, '')
  const baseKey = isSelf ? 'parent' : RELATION_KEY_ALIAS[snakeFk] ?? e.fk
  const oneKey = SEMANTIC_RELATION_ALIAS[e.child]?.[baseKey] ?? baseKey
  // Inverse many() edges are keyed by `${childTable}_${snakeFk}` to keep
  // each edge unique within a parent's relations() object. This matters
  // when a parent has multiple FK columns (creator_id + updater_id) that
  // both generate inverse many() edges from the same child table.
  const manyKey = `${e.child}_${snakeFk}`
  if (isSelf) {
    pushEdge(
      e.child,
      'one',
      `parent: one(${e.parent}, { fields: [${e.child}.${e.fk}], references: [${e.parent}.id], relationName: '${relName}' })`,
    )
    pushEdge(e.child, 'many', `children: many(${e.parent}, { relationName: '${relName}' })`)
    referencedTables.add(e.child)
  } else {
    pushEdge(
      e.child,
      'one',
      `${oneKey}: one(${e.parent}, { fields: [${e.child}.${e.fk}], references: [${e.parent}.id], relationName: '${relName}' })`,
    )
    pushEdge(e.parent, 'many', `${manyKey}: many(${e.child}, { relationName: '${relName}' })`)
    referencedTables.add(e.child)
    referencedTables.add(e.parent)
  }
}

let relationsOutput = '// Generated from drizzle/*.sql. Do not edit manually.\n'
relationsOutput += "import { relations } from 'drizzle-orm'\n"
relationsOutput += `import { ${Array.from(referencedTables).sort().join(', ')} } from './tables'\n\n`

const tablesWithRelations = new Set([...oneEdgesByTable.keys(), ...manyEdgesByTable.keys()])
for (const t of tablesWithRelations) {
  const ones = oneEdgesByTable.get(t) ?? []
  const manys = manyEdgesByTable.get(t) ?? []
  const all = [...ones, ...manys]
  relationsOutput += `export const ${t}Relations = relations(${t}, ({ one, many }) => ({\n`
  relationsOutput += all.map((line) => `  ${line}`).join(',\n')
  relationsOutput += '\n}))\n\n'
}

// --- Generate index.ts ---

let indexOutput = '// Generated from drizzle/*.sql. Do not edit manually.\n'
indexOutput += "export * from './tables'\n"
indexOutput += "export * from './relations'\n\n"
indexOutput += "import * as tablesModule from './tables'\n"
indexOutput += "import * as relationsModule from './relations'\n\n"
indexOutput += 'export const schema = {\n'
indexOutput += '  ...tablesModule,\n'
indexOutput += '  ...relationsModule,\n'
indexOutput += '}\n'

// --- Write files ---

mkdirSync(path.join(root, 'src/db/schema'), { recursive: true })
writeFileSync(path.join(root, 'src/db/schema/tables.ts'), tablesOutput)
writeFileSync(path.join(root, 'src/db/schema/relations.ts'), relationsOutput)
writeFileSync(path.join(root, 'src/db/schema/index.ts'), indexOutput)

console.log(
  `Generated ${parsedTables.length} tables, ${tablesWithRelations.size} relation sets, ${parsedTables.reduce((s, t) => s + t.indexes.length, 0)} index declarations`,
)
