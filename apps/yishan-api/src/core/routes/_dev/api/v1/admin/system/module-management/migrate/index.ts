import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { inArray } from 'drizzle-orm';
import { drizzleDb } from '@/db';
import { sysModuleMigration } from '@/db/schema/tables';
import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';
import { ResponseUtil } from '@/utils/response.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  MIGRATE: { code: 'system:module-management:migrate', label: '模块管理-迁移', group: 'module-management' },
});
registerPermissions(PERMS.MIGRATE);

interface ModuleJournal { entries: { tag: string }[] }

const adminSystemModuleManagementMigrate: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.post(
    '/:id/migrate',
    {
      access: { permission: PERMS.MIGRATE },
      schema: {
        summary: '执行模块迁移',
        description: '调用本模块的 drizzle-kit migrate；完成后把 journal 中所有 entry 同步进 sys_module_migration。',
        operationId: 'migrateModuleManagement',
        tags: ['moduleManagement'],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Number(),
            message: Type.String(),
            data: Type.Object({
              success: Type.Boolean(),
              code: Type.Number(),
              stdout: Type.String(),
              stderr: Type.String(),
              message: Type.String(),
            }),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params
      const moduleSrcDir = join(fastify.appRootSrc, 'modules', id)
      const moduleDistDir = join(fastify.appRootDist, 'modules', id)
      const drizzleKit = join(fastify.appRootDist, 'node_modules', '.bin', 'drizzle-kit')

      if (!existsSync(moduleSrcDir)) {
        reply.code(404)
        return ResponseUtil.error(reply, 40400, `模块不存在：${id}`)
      }

      const configTs = join(moduleSrcDir, 'drizzle.config.ts')
      const configJs = join(moduleDistDir, 'drizzle.config.js')
      const hasConfig = existsSync(configTs) || existsSync(configJs)
      if (!hasConfig) {
        reply.code(400)
        return ResponseUtil.error(reply, 40000, '缺少 drizzle.config.ts/js')
      }

      const cwd = existsSync(moduleSrcDir) ? moduleSrcDir : moduleDistDir
      const configFlag = existsSync(configTs) ? '--config=./drizzle.config.ts' : '--config=./drizzle.config.js'

      let code = -1
      let stdout = ''
      let stderr = ''
      try {
        const result = await runDrizzleKit(drizzleKit, cwd, configFlag, ['migrate'])
        code = result.code
        stdout = result.stdout
        stderr = result.stderr
      } catch (err) {
        reply.code(500)
        return ResponseUtil.error(reply, 50000, (err as Error).message)
      }

      if (code === 0) {
        try {
          const metaJournalPath = join(moduleSrcDir, 'drizzle', 'meta', '_journal.json')
          if (existsSync(metaJournalPath)) {
            const journal: ModuleJournal = JSON.parse(readFileSync(metaJournalPath, 'utf8'))
            const tags = journal.entries.map((e) => e.tag)
            if (tags.length > 0) {
              const existing = await drizzleDb
                .select({ hash: sysModuleMigration.hash })
                .from(sysModuleMigration)
                .where(inArray(sysModuleMigration.hash, tags))
              const existingSet = new Set(existing.map((r) => r.hash))
              const newTags = tags.filter((t) => !existingSet.has(t))
              if (newTags.length > 0) {
                await drizzleDb.insert(sysModuleMigration).values(
                  newTags.map((tag) => ({ moduleId: id, hash: tag })),
                )
              }
            }
          }
        } catch (err) {
          fastify.log.warn({ err, module: id }, 'failed to sync sys_module_migration')
        }
      }

      return ResponseUtil.success(
        reply,
        {
          success: code === 0,
          code,
          stdout,
          stderr,
          message: code === 0 ? '迁移完成' : `迁移失败，exit code ${code}`,
        },
        code === 0 ? '迁移完成' : '迁移失败',
      )
    },
  )
}

export default adminSystemModuleManagementMigrate

function runDrizzleKit(
  drizzleKit: string,
  cwd: string,
  configFlag: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(drizzleKit, [configFlag, ...args], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}
