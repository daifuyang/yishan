import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResourceAction, ResourceEndpoint, ResourceSpec } from './types.js'

type OpenApiDoc = {
  paths?: Record<string, Record<string, { operationId?: string; tags?: string[] }>>
}

const methodActionMap: Record<string, ResourceAction> = {
  get: 'list',
  post: 'create',
  put: 'update',
  delete: 'delete'
}

function toResourceAndPath(path: string): { resource: string; normalizedPath: string; actionHint?: ResourceAction } | null {
  const adminCore = path.match(/^\/api\/v1\/admin\/([^/]+)(?:\/\{id\})?\/?$/)
  if (adminCore) {
    const resource = adminCore[1]
    const normalizedPath = path.replace('{id}', ':id')
    const actionHint = path.includes('{id}') ? 'detail' : undefined
    return { resource, normalizedPath, actionHint }
  }

  const adminPlugin = path.match(/^\/api\/modules\/(?:yishan\/)?([^/]+)\/v1\/admin\/([^/]+)(?:\/\{id\})?\/?$/)
  if (adminPlugin) {
    const resource = `${adminPlugin[1]}.${adminPlugin[2]}`
    const normalizedPath = path.replace('{id}', ':id')
    const actionHint = path.includes('{id}') ? 'detail' : undefined
    return { resource, normalizedPath, actionHint }
  }

  return null
}

export async function generateResourcesFromOpenApi(baseUrl: string): Promise<{ outputPath: string; count: number }> {
  const url = new URL('/api/docs/json', baseUrl).toString()
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`拉取 OpenAPI 失败: HTTP ${response.status} ${response.statusText}`)
  }

  const doc = (await response.json()) as OpenApiDoc
  const resources = new Map<string, ResourceSpec>()

  for (const [path, methods] of Object.entries(doc.paths || {})) {
    const parsed = toResourceAndPath(path)
    if (!parsed) continue

    if (!resources.has(parsed.resource)) {
      resources.set(parsed.resource, {
        resource: parsed.resource,
        description: 'Generated from OpenAPI',
        endpoints: {}
      })
    }

    const spec = resources.get(parsed.resource) as ResourceSpec
    for (const [method, operation] of Object.entries(methods || {})) {
      const lowerMethod = method.toLowerCase()
      const action = methodActionMap[lowerMethod]
      if (!action) continue

      const endpoint: ResourceEndpoint = {
        method: method.toUpperCase() as ResourceEndpoint['method'],
        path: parsed.normalizedPath,
        requireId: parsed.normalizedPath.includes(':id')
      }

      if (endpoint.requireId && endpoint.method === 'GET') {
        spec.endpoints.detail = endpoint
      } else {
        spec.endpoints[action] = endpoint
      }

      if (!spec.description && operation.tags && operation.tags.length > 0) {
        spec.description = `Generated from tag: ${operation.tags[0]}`
      }
    }
  }

  const list = [...resources.values()].sort((a, b) => a.resource.localeCompare(b.resource))
  const sourceOutputPath = __dirname.includes('/dist/cli')
    ? join(__dirname.replace('/dist/cli', '/src/cli'), 'generated-resources.ts')
    : join(__dirname, 'generated-resources.ts')

  const tsFileText = `import type { ResourceSpec } from './types.js'\n\nexport const generatedResources: ResourceSpec[] = ${JSON.stringify(list, null, 2)}\n`
  await writeFile(sourceOutputPath, tsFileText, 'utf-8')

  if (__dirname.includes('/dist/cli')) {
    const distOutputPath = join(__dirname, 'generated-resources.js')
    const jsFileText = `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.generatedResources = ${JSON.stringify(list, null, 2)};\n`
    await writeFile(distOutputPath, jsFileText, 'utf-8')
  }

  return { outputPath: sourceOutputPath, count: list.length }
}
