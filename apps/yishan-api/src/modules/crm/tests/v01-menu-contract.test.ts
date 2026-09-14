import { describe, expect, it } from 'vitest'
import menuTree from '../config/system-menu.json'
import { SYS_ENUM_TYPES } from '@/core/schemas/enum.schema.js'

type MenuNode = {
  path?: string
  permissionCodes?: string[]
  children?: MenuNode[]
}

function flatten(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])])
}

describe('CRM V0.1 system menu', () => {
  it('exposes the customer-first routes without legacy lead destinations or permissions', () => {
    const nodes = flatten(menuTree as MenuNode[])
    const paths = nodes.flatMap((node) => (node.path ? [node.path] : []))
    const permissions = nodes.flatMap((node) => node.permissionCodes ?? [])

    expect(paths).toEqual(
      expect.arrayContaining([
        '/crm/dashboard',
        '/crm/customers',
        '/crm/pool',
        '/crm/contacts',
        '/crm/opportunities',
        '/crm/quotations',
        '/crm/contracts',
        '/crm/payments',
        '/crm/tasks',
        '/crm/products',
      ]),
    )
    expect(paths).not.toEqual(expect.arrayContaining([
      '/crm/leads',
      '/crm/lead-pool',
      '/crm/activities',
      '/crm/visits',
      '/crm/tickets',
      '/crm/settings',
    ]))
    expect(permissions).not.toEqual(expect.arrayContaining([
      'crm:lead:list',
      'crm:lead:create',
      'crm:lead:update',
      'crm:lead:delete',
      'crm:lead:claim',
      'crm:lead:assign',
      'crm:lead:return',
      'crm:lead:qualify',
      'crm:lead:disqualify',
      'crm:lead:reactivate',
      'crm:lead:convert',
    ]))
  })

  it('does not permit or retain the retired Lead status enum type', async () => {
    const seed = await import('../seed.js') as {
      RETIRED_CRM_ENUM_TYPES?: readonly string[]
    }

    expect(SYS_ENUM_TYPES).not.toContain('crm_lead_status')
    expect(seed.RETIRED_CRM_ENUM_TYPES).toEqual(['crm_lead_status'])
  })
})
