import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inArray } from 'drizzle-orm';
import { drizzleDb } from '@/db';
import { sysModule, sysModuleMigration } from '@/db/schema/tables';
import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { moduleRoutePrefix } from '@/core/module-loader/module-loader.js';
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';
import { ResponseUtil } from '@/utils/response.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST: { code: 'system:module-management:list', label: '模块管理-列表', group: 'module-management' },
});
registerPermissions(PERMS.LIST);

interface ModuleJournalEntry { tag: string; breakpoints: boolean }

const moduleItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  routePrefix: Type.String(),
  tablePrefix: Type.String(),
  version: Type.String(),
  enabled: Type.Boolean(),
  mounted: Type.Boolean(),
  hasSchema: Type.Boolean(),
  hasDrizzle: Type.Boolean(),
  appliedMigrations: Type.Array(Type.String()),
  pendingMigrations: Type.Array(Type.String()),
});

const adminSystemModuleManagementList: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.get(
    '/',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '模块列表',
        description: '扫描 src/modules/ 并合并 sys_module 行；标注 enabled、是否已挂载、applied vs pending 迁移。routePrefix 由 moduleRoutePrefix() 统一生成为 /api/${id}。',
        operationId: 'listModuleManagement',
        tags: ['moduleManagement'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Number(),
            message: Type.String(),
            data: Type.Object({ items: Type.Array(moduleItemSchema) }),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const DEV_MODULES_DIR = join(fastify.appRootSrc, 'modules')
      const idsOnDisk: string[] = []
      if (existsSync(DEV_MODULES_DIR)) {
        for (const id of readdirSync(DEV_MODULES_DIR)) {
          if (
            existsSync(join(DEV_MODULES_DIR, id, 'module.ts')) ||
            existsSync(join(DEV_MODULES_DIR, id, 'module.js'))
          ) {
            idsOnDisk.push(id)
          }
        }
      }
      idsOnDisk.sort()

      const rows = idsOnDisk.length === 0
        ? []
        : await drizzleDb
            .select()
            .from(sysModule)
            .where(inArray(sysModule.id, idsOnDisk))
      const rowMap = new Map(rows.map((r) => [r.id, r]))

      const appliedRows = idsOnDisk.length === 0
        ? []
        : await drizzleDb
            .select({ moduleId: sysModuleMigration.moduleId, hash: sysModuleMigration.hash })
            .from(sysModuleMigration)
            .where(inArray(sysModuleMigration.moduleId, idsOnDisk))
      const appliedMap = new Map<string, Set<string>>()
      for (const r of appliedRows) {
        if (!appliedMap.has(r.moduleId)) appliedMap.set(r.moduleId, new Set())
        appliedMap.get(r.moduleId)!.add(r.hash)
      }

      const loader = (fastify as unknown as { moduleLoader: { isMounted: (id: string) => boolean } }).moduleLoader
      const items = idsOnDisk.map((id) => {
        const row = rowMap.get(id)
        const moduleDir = join(DEV_MODULES_DIR, id)
        const drizzleDir = join(moduleDir, 'drizzle')
        const hasDrizzle = existsSync(drizzleDir)
        const metaJournalPath = join(drizzleDir, 'meta', '_journal.json')
        let journalTags: string[] = []
        if (existsSync(metaJournalPath)) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const journal = require(metaJournalPath) as { entries: ModuleJournalEntry[] }
            journalTags = journal.entries.map((e) => e.tag)
          } catch {
            journalTags = []
          }
        }
        const appliedSet = appliedMap.get(id) ?? new Set<string>()
        const pendingMigrations = journalTags.filter((tag) => !appliedSet.has(tag))
        const appliedMigrations = journalTags.filter((tag) => appliedSet.has(tag))
        return {
          id,
          name: row?.name ?? id,
          routePrefix: moduleRoutePrefix(id),
          tablePrefix: row?.tablePrefix ?? `${id}_`,
          version: row?.version ?? '0.0.0',
          enabled: row ? row.enabled === 1 : false,
          mounted: loader.isMounted(id),
          hasSchema: existsSync(join(moduleDir, 'db', 'schema.ts')),
          hasDrizzle,
          appliedMigrations,
          pendingMigrations,
        }
      })

      return ResponseUtil.success(reply, { items }, '获取模块列表成功')
    }
  )
}

export default adminSystemModuleManagementList
