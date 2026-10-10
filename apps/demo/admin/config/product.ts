import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readInstalledModules } from '@yishan/core-admin/manifest';
import { selectOpenApi } from '@yishan/core-admin/openapi';

export const apiRoot = path.resolve(__dirname, '../../api');
export const installedModuleIds = readInstalledModules(apiRoot).map(module => module.id);

// Umi's OpenAPI explorer/generator consumes the same product partition as the workspace command.
const cache = path.resolve(__dirname, '../node_modules/.cache/admin-openapi');
mkdirSync(cache, { recursive: true });
export const productSchemaPath = path.join(cache, 'product.json');
const schema = JSON.parse(readFileSync(path.join(apiRoot, 'openapi.json'), 'utf8'));
writeFileSync(productSchemaPath, JSON.stringify(selectOpenApi(schema, route => installedModuleIds.some(id => route.startsWith(`/api/${id}/`)))));
