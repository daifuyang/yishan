import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';
import { ResponseUtil } from '@/utils/response.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  SEED: { code: 'system:module-control:seed', label: '模块 seed', group: 'module-control' },
});
registerPermissions(PERMS.SEED);

const adminSystemModuleControlSeed: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.post(
    '/:id/seed',
    {
      access: { permission: PERMS.SEED },
      schema: {
        summary: '运行模块 seed 脚本',
        description: '执行 dist/modules/<id>/{seed,scripts/seed,db/seed}.js。',
        operationId: 'seedModuleControl',
        tags: ['moduleControl'],
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
      if (!existsSync(moduleSrcDir)) {
        reply.code(404)
        return ResponseUtil.error(reply, 40400, `模块不存在：${id}`)
      }
      const candidates = [
        join(moduleSrcDir, 'seed.ts'),
        join(moduleSrcDir, 'scripts', 'seed.ts'),
        join(moduleSrcDir, 'db', 'seed.ts'),
      ]
      const sourceEntry = candidates.find((p) => existsSync(p))
      if (!sourceEntry) {
        reply.code(400)
        return ResponseUtil.error(
          reply,
          40000,
          `模块 ${id} 缺少 seed 脚本（期望 seed.ts / scripts/seed.ts / db/seed.ts 之一）`,
        )
      }
      const relEntry = sourceEntry.slice(moduleSrcDir.length + 1)
      const distEntry = join(moduleDistDir, relEntry.replace(/\.ts$/, '.js'))
      if (!existsSync(distEntry)) {
        reply.code(400)
        return ResponseUtil.error(
          reply,
          40000,
          `seed 脚本未编译：${distEntry}（先执行 pnpm --filter yishan-api build:ts）`,
        )
      }
      try {
        const { code, stdout, stderr } = await runNode(moduleDistDir, distEntry)
        return ResponseUtil.success(
          reply,
          {
            success: code === 0,
            code,
            stdout,
            stderr,
            message: code === 0 ? 'seed 完成' : `seed 失败，exit code ${code}`,
          },
          code === 0 ? 'seed 完成' : 'seed 失败',
        )
      } catch (err) {
        reply.code(500)
        return ResponseUtil.error(reply, 50000, (err as Error).message)
      }
    },
  )
}

export default adminSystemModuleControlSeed

function runNode(
  cwd: string,
  entry: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}
