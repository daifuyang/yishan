/**
 * P0 行为基线：模块生命周期（scan → sync → mount）。
 *
 * 只覆盖 ModuleLoader 中可脱离 app.ts 直接验证的真实逻辑；gate（40400）、重启保持
 * 运行时开关、生产环境隐藏 _dev 路由由真实启动探针覆盖，见
 * docs/verification/yishan-source-first-p0/module-baseline.md。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { sysModule } from '../src/db/schema/tables.js'
import {
  ModuleLoader,
  moduleRoutePrefix,
  scanDiskModulesPure,
  syncModulesFromDiskPure,
  type ModuleDiskMeta,
} from '../src/core/module-loader/module-loader.js'

type Write = { op: 'insert' | 'update'; table: unknown; values: Record<string, unknown> }

/** 记录写入的最小 drizzle 替身：select 返回 existingIds 对应的行。 */
function recordingDb(existingIds: string[]) {
  const writes: Write[] = []
  const db = {
    select: () => ({ from: () => ({ where: async () => existingIds.map((id) => ({ id })) }) }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => { writes.push({ op: 'update', table, values }) },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => { writes.push({ op: 'insert', table, values }) },
    }),
  }
  return { db: db as unknown as Parameters<typeof syncModulesFromDiskPure>[0], writes }
}

const diskMeta = (id: string): ModuleDiskMeta => ({
  id,
  name: id,
  tablePrefix: `${id}_`,
  version: '0.0.0',
  moduleDir: `/virtual/${id}`,
})

function writeDistModule(distRoot: string, id: string, metaSource = `{ id: '${id}' }`) {
  const dir = join(distRoot, 'modules', id)
  mkdirSync(join(dir, 'routes'), { recursive: true })
  writeFileSync(join(dir, 'module.js'), `exports.meta = ${metaSource}\n`)
  writeFileSync(
    join(dir, 'routes', 'index.js'),
    `module.exports = async function (app) { app.get('/ping', async () => ({ module: '${id}' })) }\n`,
  )
}

describe('module lifecycle baseline', () => {
  const dirs: string[] = []
  const tmpRoot = () => {
    const root = mkdtempSync(join(tmpdir(), 'yishan-p0-mod-'))
    dirs.push(root)
    return { srcRoot: join(root, 'src'), distRoot: join(root, 'dist') }
  }

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('route prefix is hard-wired to /api/<id>', () => {
    expect(moduleRoutePrefix('demo')).toBe('/api/demo')
  })

  it('sync inserts unseen modules with traffic enabled = 1', async () => {
    const { db, writes } = recordingDb([])
    const result = await syncModulesFromDiskPure(db, [diskMeta('alpha')])
    expect(result).toEqual({ inserted: 1, updated: 0 })
    expect(writes).toHaveLength(1)
    expect(writes[0].op).toBe('insert')
    expect(writes[0].table).toBe(sysModule)
    expect(writes[0].values).toMatchObject({ id: 'alpha', tablePrefix: 'alpha_', version: '0.0.0', enabled: 1 })
  })

  it('sync never writes `enabled` for an existing module (runtime toggle survives restart)', async () => {
    const { db, writes } = recordingDb(['alpha'])
    const result = await syncModulesFromDiskPure(db, [diskMeta('alpha'), diskMeta('beta')])
    expect(result).toEqual({ inserted: 1, updated: 1 })
    const update = writes.find((w) => w.op === 'update')
    expect(update).toBeDefined()
    expect(Object.keys(update!.values).sort()).toEqual(['name', 'tablePrefix', 'updatedAt', 'version'])
    expect(update!.values).not.toHaveProperty('enabled')
  })

  it('mounts packed module routes under /api/<id> and tracks them as module ids', async () => {
    const { srcRoot, distRoot } = tmpRoot()
    writeDistModule(distRoot, 'alpha')
    writeDistModule(distRoot, 'hidden', `{ id: 'hidden', enabled: false }`)

    const app = Fastify()
    const loader = new ModuleLoader(app, srcRoot, distRoot)
    const scanned = await loader.scanDiskModules()
    expect(scanned.map((m) => m.id)).toEqual(['alpha'])
    await loader.mountAllOnDisk(scanned)
    await app.ready()

    expect([...loader.listModuleIds()]).toEqual(['alpha'])
    const ok = await app.inject({ method: 'GET', url: '/api/alpha/ping' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ module: 'alpha' })
    const packedOut = await app.inject({ method: 'GET', url: '/api/hidden/ping' })
    expect(packedOut.statusCode).toBe(404)
    await app.close()
  })

  it('an install with no modules still boots core routes', async () => {
    const { srcRoot, distRoot } = tmpRoot()
    const app = Fastify()
    app.get('/api/health', async () => ({ ok: true }))
    const loader = new ModuleLoader(app, srcRoot, distRoot)
    const scanned = await loader.scanDiskModules()
    expect(scanned).toEqual([])
    await loader.mountAllOnDisk(scanned)
    await app.ready()
    expect(loader.listModuleIds().size).toBe(0)
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200)
    await app.close()
  })

  it('current baseline: meta.id format is not validated at scan time (P1 scope)', async () => {
    const { srcRoot, distRoot } = tmpRoot()
    writeDistModule(distRoot, 'Bad-Id', `{ id: 'Bad-Id' }`)
    const scanned = await scanDiskModulesPure(srcRoot, distRoot)
    expect(scanned.map((m) => m.id)).toEqual(['Bad-Id'])
  })
})
