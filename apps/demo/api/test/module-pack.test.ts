import { describe, expect, it } from 'vitest'
import { demoModules } from '../src/manifest'
import { migrationManifest } from '../src/scripts/migrate'

describe('product manifest replaces source enabled switches', () => {
  it('retains the previous installed business modules', () => {
    expect(demoModules.map(module => module.id)).toEqual(['demo', 'portal', 'shop'])
  })
  it('excludes CRM from runtime installation without discarding its implementation', () => {
    expect(demoModules.some(module => String(module.id) === 'crm')).toBe(false)
  })
  it('plans migrations only for installed modules with independent ledgers', () => {
    expect(migrationManifest.map(source => source.id)).toEqual(['system', 'demo', 'portal', 'shop'])
    expect(new Set(migrationManifest.map(source => source.historyTable)).size).toBe(4)
  })
})
