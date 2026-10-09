import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { collectArchitectureErrors } = require('./check-api-architecture.cjs')
const { readInstalledModules } = require('./module-manifest.cjs')

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'yishan-architecture-'))
  for (const name of ['api', 'system-api', 'database', 'contracts']) {
    const dir = join(root, 'packages/core', name)
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@yishan/core-${name}`, exports: { '.': './dist/index.js', './public': './dist/public.js' } }))
  }
  return root
}

test('allows public contracts and rejects reverse dependencies in imports, require and re-exports', () => {
  const root = repository()
  try {
    writeFileSync(join(root, 'packages/core/api/src/index.ts'), "import type { Contract } from '@yishan/core-contracts'; export { Contract } from '@yishan/core-contracts/public'")
    assert.deepEqual(collectArchitectureErrors(root), [])
    for (const text of [
      "import { db } from '@yishan/core-database'",
      "export { db } from '@yishan/core-database'",
      "const db = require('@yishan/core-database')",
      "async function f() { return import('@yishan/core-database') }",
      'async function f() { return import(`@yishan/core-database`) }',
    ]) {
      writeFileSync(join(root, 'packages/core/api/src/index.ts'), text)
      assert.match(collectArchitectureErrors(root).join('\n'), /core-api.*core-database/)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects unexported subpaths, cross-package relative access, core application imports and cross-module imports', () => {
  const root = repository()
  const apiRoot = join(root, 'apps/demo/api')
  mkdirSync(join(apiRoot, 'src/modules/a/routes'), { recursive: true })
  mkdirSync(join(apiRoot, 'src/modules/b/db'), { recursive: true })
  writeFileSync(join(apiRoot, 'package.json'), JSON.stringify({ name: '@yishan/demo-api' }))
  try {
    for (const text of [
      "import { privateDb } from '@yishan/core-database/src/private'",
      "export * from '../../database/src/private'",
      "import { app } from '@yishan/demo-api'",
    ]) {
      writeFileSync(join(root, 'packages/core/system-api/src/index.ts'), text)
      assert.notDeepEqual(collectArchitectureErrors(root), [])
    }
    writeFileSync(join(root, 'packages/core/system-api/src/index.ts'), '')
    writeFileSync(join(apiRoot, 'src/modules/a/routes/index.ts'), "export * from '../../b/db/schema'")
    assert.match(collectArchitectureErrors(root).join('\n'), /cross-module/)
    writeFileSync(join(apiRoot, 'src/modules/a/routes/index.ts'), "import { table } from '../db/schema'")
    assert.match(collectArchitectureErrors(root).join('\n'), /routes.*schema/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('reads only explicit installation declarations without importing backend side effects', () => {
  const root = repository()
  const apiRoot = join(root, 'apps/demo/api')
  mkdirSync(join(apiRoot, 'src/modules/demo'), { recursive: true })
  try {
    writeFileSync(join(apiRoot, 'src/manifest.ts'), "import installed from './modules/demo/module'; export const modules = [installed] as const")
    writeFileSync(join(apiRoot, 'src/modules/demo/module.ts'), "throw new Error('must not execute'); const definition = {id:'demo'}; export default definition")
    assert.deepEqual(readInstalledModules(apiRoot).map(module => module.id), ['demo'])
    writeFileSync(join(apiRoot, 'src/manifest.ts'), "export const modules = [loadUnknown()] as const")
    assert.throws(() => readInstalledModules(apiRoot), /imported module identifiers/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects business access to system tables, private export aliases, concrete clients and other products', () => {
  const root = repository()
  const apiRoot = join(root, 'apps/demo/api')
  const services = join(apiRoot, 'src/modules/demo/services')
  mkdirSync(services, { recursive: true })
  mkdirSync(join(root, 'apps/other/api/src'), { recursive: true })
  writeFileSync(join(apiRoot, 'package.json'), JSON.stringify({ name: '@yishan/demo-api' }))
  writeFileSync(join(root, 'apps/other/api/package.json'), JSON.stringify({ name: '@company/other-api', exports: '.' }))
  writeFileSync(join(root, 'packages/core/system-api/package.json'), JSON.stringify({ name: '@yishan/core-system-api', exports: { '.': './dist/index.js', './schema': './dist/db/schema/index.js', './database': './dist/db/index.js', './hidden': './dist/core/repositories/user.js', './auth-alias': './dist/core/auth/index.js' } }))
  try {
    for (const text of [
      "import { sysUser } from '@yishan/core-system-api/schema'",
      "export * from '@yishan/core-system-api/hidden'",
      "const auth = require('@yishan/core-system-api/auth-alias')",
      "import { drizzleDb as db } from '@yishan/core-system-api/database'",
      "import * as db from '@yishan/core-database'",
      "const {drizzleDb} = require('@yishan/core-database')",
      "import {app} from '@company/other-api'",
    ]) {
      writeFileSync(join(services, 'index.ts'), text)
      assert.notDeepEqual(collectArchitectureErrors(root), [], text)
    }
    writeFileSync(join(services, 'index.ts'), "import type { Database } from '@yishan/core-database'; import {dbManager} from '@yishan/core-system-api/database'")
    assert.deepEqual(collectArchitectureErrors(root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checks product extension table prefixes along with module schemas', () => {
  const root = repository()
  const apiRoot = join(root, 'apps/demo/api')
  mkdirSync(join(apiRoot, 'src/extensions'), { recursive: true })
  mkdirSync(join(apiRoot, 'src/modules'), { recursive: true })
  writeFileSync(join(apiRoot, 'package.json'), JSON.stringify({ name: '@yishan/demo-api' }))
  const schema = join(apiRoot, 'src/extensions/profile.schema.ts')
  const command = fileURLToPath(new URL('./check-module-naming.mjs', import.meta.url))
  try {
    writeFileSync(schema, "const table = mysqlTable('sys_profile', {})")
    assert.equal(spawnSync(process.execPath, [command, root]).status, 1)
    writeFileSync(schema, "const table = mysqlTable('demo_profile', {})")
    assert.equal(spawnSync(process.execPath, [command, root]).status, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('manifest accepts package modules through public exports without executing code', () => {
  const root = repository()
  const apiRoot = join(root, 'apps/demo/api')
  const packageRoot = join(apiRoot, 'node_modules/@example/feature')
  mkdirSync(join(apiRoot, 'src'), { recursive: true })
  mkdirSync(join(packageRoot, 'dist'), { recursive: true })
  try {
    writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: '@example/feature', exports: { '.': './dist/index.js' } }))
    writeFileSync(join(packageRoot, 'dist/index.js'), "throw Error('never execute'); const feature = { id: 'feature' }; exports.featureModule = feature")
    writeFileSync(join(apiRoot, 'src/manifest.ts'), "import { featureModule } from '@example/feature'; export const modules = [featureModule]")
    assert.deepEqual(readInstalledModules(apiRoot).map(module => module.id), ['feature'])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('contracts reject platform runtime imports and dependency declarations', () => {
  const root = repository()
  try {
    writeFileSync(join(root, 'packages/core/contracts/src/index.ts'), "import {readFile} from 'node:fs'")
    assert.match(collectArchitectureErrors(root).join('\n'), /contracts.*platform/)
    writeFileSync(join(root, 'packages/core/contracts/src/index.ts'), '')
    writeFileSync(join(root, 'packages/core/contracts/package.json'), JSON.stringify({ name: '@yishan/core-contracts', dependencies: { fastify: '*' } }))
    assert.match(collectArchitectureErrors(root).join('\n'), /contracts.*platform/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('Core cannot import legacy applications and future product web packages cannot cross products', () => {
  const root = repository()
  try {
    for (const [directory, name] of [['apps/yishan-admin', 'yishan-admin'], ['apps/crm/web', '@yishan/crm-web'], ['apps/axis/web', '@yishan/axis-web'], ['apps/crm/contracts', '@yishan/crm-contracts']]) {
      mkdirSync(join(root, directory, 'src'), { recursive: true })
      writeFileSync(join(root, directory, 'package.json'), JSON.stringify({ name, exports: { '.': './dist/index.js' } }))
    }
    writeFileSync(join(root, 'packages/core/api/src/index.ts'), "import admin from 'yishan-admin'")
    assert.match(collectArchitectureErrors(root).join('\n'), /forbidden dependency.*yishan-admin/)
    writeFileSync(join(root, 'packages/core/api/src/index.ts'), '')
    writeFileSync(join(root, 'apps/crm/web/src/index.ts'), "import web from '@yishan/axis-web'")
    assert.match(collectArchitectureErrors(root).join('\n'), /cross-product/)
    writeFileSync(join(root, 'apps/crm/web/src/index.ts'), "import type { Contract } from '@yishan/crm-contracts'")
    assert.deepEqual(collectArchitectureErrors(root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})
