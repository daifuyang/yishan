import Fastify from 'fastify';
import AutoLoad from '@fastify/autoload';
import { writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import registerSchemas from '../core/schemas/index.js';
import swaggerPlugin from '../core/plugins/external/swagger.js';

const noOpGuard = async () => undefined;

async function buildOpenApiDocument() {
  const app = Fastify({ logger: false });
  app.decorate('authenticate', noOpGuard);
  app.decorate('requirePermission', () => noOpGuard);
  app.decorate('requireRole', () => noOpGuard);
  app.decorate('rateLimit', () => noOpGuard);

  await app.register(swaggerPlugin);
  await app.register(registerSchemas);
  await app.register(AutoLoad, {
    dir: join(__dirname, '../core/routes'),
    autoHooks: true,
    cascadeHooks: true,
  });

  const modulesDir = join(__dirname, '../plugins/modules');
  for (const moduleName of readdirSync(modulesDir)) {
    const moduleRoot = join(modulesDir, moduleName);
    if (!statSync(moduleRoot).isDirectory()) continue;
    const routesDir = join(moduleRoot, 'routes');
    if (!existsSync(routesDir)) continue;
    await app.register(AutoLoad, {
      dir: routesDir,
      autoHooks: true,
      cascadeHooks: true,
      options: { prefix: `api/modules/${moduleName}` },
    });
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
