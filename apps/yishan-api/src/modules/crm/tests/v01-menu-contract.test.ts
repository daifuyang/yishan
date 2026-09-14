import { describe, expect, it } from 'vitest'
import menuTree from '../config/system-menu.json'

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
    expect(permissions).not.toEqual(expect.arrayContaining(['crm:lead:list', 'crm:lead:create']))
  })
})
