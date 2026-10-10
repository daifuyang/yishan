import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from '../../../../test/runtime-fixture'
import {
  CONTRACT_STATUSES,
  CUSTOMER_STATUSES,
  OPPORTUNITY_STAGES,
  QUOTATION_STATUSES,
  TASK_STATUSES,
} from '../domain/statuses.js'

type SeedEntry = {
  type: string
  code: string
  name: string
  sort: number
}

async function loadSeedEntries(): Promise<readonly SeedEntry[] | undefined> {
  const seed = await import('../seed.js')
  return (seed as unknown as { CRM_ENUM_SEED?: readonly SeedEntry[] }).CRM_ENUM_SEED
}

describe('CRM V0.1 migration and seed registration', () => {
  it('registers the V0.1 lifecycle migration in the Drizzle journal', () => {
    const journalPath = resolve(process.cwd(), 'src/modules/crm/drizzle/meta/_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>
    }

    expect(journal.entries).toContainEqual(expect.objectContaining({
      idx: 13,
      tag: '0052_crm-v01-customer-lifecycle',
    }))
  })

  it('seeds each CRM status code once from the V0.1 descriptor contract', async () => {
    const entries = await loadSeedEntries()
    expect(entries).toBeDefined()

    const typedEntries = entries!
    const keys = typedEntries.map((entry) => `${entry.type}:${entry.code}`)
    expect(new Set(keys).size).toBe(keys.length)

    const valuesFor = (type: string) => typedEntries
      .filter((entry) => entry.type === type)
      .map(({ code, name }) => ({ value: code, label: name }))

    expect(valuesFor('crm_customer_status')).toEqual(
      CUSTOMER_STATUSES.map(({ value, label }) => ({ value, label })),
    )
    expect(valuesFor('crm_opportunity_stage')).toEqual(
      OPPORTUNITY_STAGES.map(({ value, label }) => ({ value, label })),
    )
    expect(valuesFor('crm_quotation_status')).toEqual(
      QUOTATION_STATUSES.map(({ value, label }) => ({ value, label })),
    )
    expect(valuesFor('crm_contract_status')).toEqual(
      CONTRACT_STATUSES.map(({ value, label }) => ({ value, label })),
    )
    expect(valuesFor('crm_task_status')).toEqual(
      TASK_STATUSES.map(({ value, label }) => ({ value, label })),
    )
  })
})
