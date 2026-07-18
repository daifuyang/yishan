import { describe, expect, it } from 'vitest'
import manifest from '../manifest.js'
import { validateManifest } from '../../../../core/plugin-platform/manifest.js'

describe('CRM plugin contracts', () => {
  it('declares a valid manifest with permissions used by its admin routes', () => {
    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] })
    expect(manifest.routeBase).toBe('/api/modules/crm/v1')
    expect(manifest.permissions.map((permission) => permission.code)).toEqual(expect.arrayContaining([
      'crm:hospital:list', 'crm:customer:list', 'crm:member:list', 'crm:dispatch:list',
    ]))
  })
})
