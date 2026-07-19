import Fastify, { type FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import registerSchemas from '../core/schemas/index.js';
import swaggerPlugin from '../core/plugins/external/swagger.js';

const noOpGuard = async () => undefined;

async function buildOpenApiDocument() {
  const app = Fastify({ logger: false });
  app.decorate('authenticate', noOpGuard);
  app.decorate('requirePermission', () => noOpGuard as any);
  app.decorate('requireRole', noOpGuard as any);
  app.decorate('rateLimit', () => noOpGuard as any);

  await app.register(swaggerPlugin);
  await app.register(registerSchemas);
  await app.register(AutoLoad, {
    dir: join(__dirname, '../core/routes'),
    autoHooks: true,
    cascadeHooks: true,
  });

  // Wave 2: catalog-driven OpenAPI emission.
  //
  // `apps/yishan-api/src/plugins/modules/` has been deleted in Wave 2;
  // the legacy AutoLoad loop on it is replaced with a catalog-driven
  // mount.
  //
  // The catalog's plugin routes live under
  // `plugins/<vendor>/<slug>/api/routes/<v>/<sub>/index.ts` — outside
  // `apps/yishan-api/src/`, so they are not compiled to `dist/`, and
  // `@fastify/autoload`'s CJS loader cannot import `.ts` files at
  // Node-native runtime (tsx / `--experimental-strip-types` interactions
  // with `require()` in CJS contexts are limited as of Node 22).
  //
  // For Wave 2 the only catalog plugin is `yishan/hello`. Its route is
  // the single stable GET, and we mirror it here so the regenerated
  // `openapi.json` reflects the new `/api/plugins/yishan/hello/v1/admin/`
  // prefix. Plugins in later waves will arrive with compiled artifacts
  // and resume the AutoLoad-driven pattern.
  const repoRoot = join(__dirname, '..', '..', '..', '..');
  const catalogPath = join(repoRoot, 'artifacts', 'plugin-catalog.json');
  interface CatalogEntry { id: string; kind?: 'sample' | 'production' }
  let catalog: { plugins: CatalogEntry[] } = { plugins: [] };
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
      plugins: CatalogEntry[];
    };
  } catch {
    // missing catalog = empty plugin set
  }
  for (const entry of catalog.plugins) {
    if (entry.id !== 'yishan/hello') continue;
    // Wave 2 stops short of plugging AutoLoad into the catalog, so we
    // manually register the hello route. The catalog's `api.prefix` is
    // `/api/plugins/yishan/hello/v1`; the sub-plugin below mounts a GET
    // at `<prefix>/admin/` (the route file at
    // `plugins/yishan/hello/api/routes/v1/admin/index.ts` declares `route.get('/', ...)`,
    // and AutoLoad's traversal adds the `v1/admin/` segments). Without
    // AutoLoad here we hardcode the matching URL so the OpenAPI doc
    // mirrors what the runtime boot will expose.
    const prefix = 'api/plugins/yishan/hello/v1/admin';
    const helloPlugin = async (
      instance: FastifyInstance,
      _opts: Record<string, unknown>
    ) => {
      instance.route({
        method: 'GET',
        url: '/',
        schema: {
          summary: 'Hello 示例插件健康检查',
          description: '验证插件 manifest、鉴权和管理端路由是否已正确加载',
          operationId: 'getHelloAdminHealth',
          tags: ['helloModule'],
          security: [{ bearerAuth: [] }],
          'x-permission-code': 'hello:health:read',
          'x-permission-label': '健康检查-读取',
        },
        handler: async (_request, reply) => {
          reply.code(200);
          return {
            success: true,
            code: 0,
            message: '操作成功',
            data: {
              module: 'hello',
              status: 'ok',
              time: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          };
        },
      });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(helloPlugin as any, { prefix });
  }

  await app.ready();
  const document = app.swagger();
  await app.close();
  return document;
}

async function main() {
  const document = await buildOpenApiDocument();
  const outputPath = join(__dirname, '../../openapi.json');
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`OpenAPI exported to ${outputPath}`);
}

void main();
