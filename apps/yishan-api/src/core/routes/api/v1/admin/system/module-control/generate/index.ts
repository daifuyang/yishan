import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';
import { ResponseUtil } from '@/utils/response.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  GENERATE: { code: 'system:module-control:generate', label: '生成模块迁移文件', group: 'module-control' },
});
registerPermissions(PERMS.GENERATE);

const adminSystemModuleControlGenerate: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.post(
    '/:id/generate',
    {
      access: { permission: PERMS.GENERATE },
      schema: {
        summary: '生成模块迁移文件',
        description: '调用本模块的 drizzle-kit generate。',
        operationId: 'generateModuleControlMigration',
        tags: ['moduleControl'],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ name: Type.Optional(Type.String()) }),
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
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { name?: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const moduleSrcDir = join(fastify.appRootSrc, 'modules', id)
      const drizzleKit = join(fastify.appRootDist, 'node_modules', '.bin', 'drizzle-kit')
      if (!existsSync(moduleSrcDir)) {
        reply.code(404)
        return ResponseUtil.error(reply, 40400, `模块不存在：${id}`)
      }
      const configTs = join(moduleSrcDir, 'drizzle.config.ts')
      if (!existsSync(configTs)) {
        reply.code(400)
        return ResponseUtil.error(reply, 40000, '缺少 drizzle.config.ts')
      }
      const migrationName = request.body?.name?.trim() || `update_${new Date().toISOString().slice(0, 10)}`
      try {
        const { code, stdout, stderr } = await runDrizzleKit(
          drizzleKit,
          moduleSrcDir,
          '--config=./drizzle.config.ts',
          ['generate', '--name', migrationName],
        )
        return ResponseUtil.success(
          reply,
          {
            success: code === 0,
            code,
            stdout,
            stderr,
            message: code === 0 ? `已生成迁移：${migrationName}` : `生成失败，exit code ${code}`,
          },
          code === 0 ? '已生成' : '生成失败',
        )
      } catch (err) {
        reply.code(500)
        return ResponseUtil.error(reply, 50000, (err as Error).message)
      }
    },
  )
}

export default adminSystemModuleControlGenerate

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
