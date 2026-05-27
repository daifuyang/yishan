import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ResourceSpec } from './types.js'
import { generatedResources } from './generated-resources.js'

const coreResources: ResourceSpec[] = [
  {
    resource: 'users',
    description: '系统用户',
    endpoints: {
      list: { method: 'GET', path: '/api/v1/admin/users' },
      detail: { method: 'GET', path: '/api/v1/admin/users/:id', requireId: true },
      create: { method: 'POST', path: '/api/v1/admin/users' },
      update: { method: 'PUT', path: '/api/v1/admin/users/:id', requireId: true },
      delete: { method: 'DELETE', path: '/api/v1/admin/users/:id', requireId: true }
    }
  },
  {
    resource: 'roles',
    description: '角色',
    endpoints: {
      list: { method: 'GET', path: '/api/v1/admin/roles' },
      detail: { method: 'GET', path: '/api/v1/admin/roles/:id', requireId: true },
      create: { method: 'POST', path: '/api/v1/admin/roles' },
      update: { method: 'PUT', path: '/api/v1/admin/roles/:id', requireId: true },
      delete: { method: 'DELETE', path: '/api/v1/admin/roles/:id', requireId: true }
    }
  },
  {
    resource: 'departments',
    description: '部门',
    endpoints: {
      list: { method: 'GET', path: '/api/v1/admin/departments' },
      detail: { method: 'GET', path: '/api/v1/admin/departments/:id', requireId: true },
      create: { method: 'POST', path: '/api/v1/admin/departments' },
      update: { method: 'PUT', path: '/api/v1/admin/departments/:id', requireId: true },
      delete: { method: 'DELETE', path: '/api/v1/admin/departments/:id', requireId: true }
    }
  }
]

function inferPluginResources(): ResourceSpec[] {
  const modulesRoot = join(__dirname, '../plugins/modules')
  if (!existsSync(modulesRoot)) {
    return []
  }

  const result: ResourceSpec[] = []
  const moduleNames = readdirSync(modulesRoot)
  for (const moduleName of moduleNames) {
    const adminRoot = join(modulesRoot, moduleName, 'routes/v1/admin')
    if (!existsSync(adminRoot)) {
      continue
    }

    const resourceDirs = readdirSync(adminRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const item of resourceDirs) {
      const resourceName = item.name
      const routePrefix = `/api/modules/${moduleName}/v1/admin/${resourceName}`
      result.push({
        resource: `${moduleName}.${resourceName}`,
        description: `插件 ${moduleName} 资源 ${resourceName}`,
        endpoints: {
          list: { method: 'GET', path: routePrefix },
          detail: { method: 'GET', path: `${routePrefix}/:id`, requireId: true },
          create: { method: 'POST', path: routePrefix },
          update: { method: 'PUT', path: `${routePrefix}/:id`, requireId: true },
          delete: { method: 'DELETE', path: `${routePrefix}/:id`, requireId: true }
        }
      })
    }
  }

  return result
}

export function getResourceRegistry(): ResourceSpec[] {
  const merged = [...coreResources, ...generatedResources, ...inferPluginResources()]
  const dedup = new Map<string, ResourceSpec>()
  for (const item of merged) {
    dedup.set(item.resource, item)
  }
  return [...dedup.values()]
}
