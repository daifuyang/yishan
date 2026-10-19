import { describe, expect, it, vi } from 'vitest'
import { Type } from '@sinclair/typebox'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'
import { createOperationTools } from '../services/operation-tools.js'
import { systemAiCapabilities } from '@yishan/core-system-api'

const capability: AiCapability = {
  name: 'department_draft', moduleId: 'system', operationId: 'adminDepartmentsCreate',
  permissionCode: 'system:department:create', riskLevel: 'prepare', enabled: true,
  description: '创建部门草稿', inputSchema: Type.Object({ name: Type.Optional(Type.String()) }),
  operation: { id: 'department.create', name: '创建部门', type: 'create', formKey: 'department.create' },
  execute: async () => ({ data: {} }),
}

describe('operation tools', () => {
  it('keeps existing native edit and delete preparations reachable through the four tools', async () => {
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: {}, mutated: false } }))
    const tools = createOperationTools({ capabilities: systemAiCapabilities, execute })
    await tools.execute('update_form_draft', { operationId: 'user.update', values: { id: 12, deptIds: [3], gender: '1', birthDate: '1996-10-02' } })
    expect(execute).toHaveBeenLastCalledWith('prepare_update_user', { id: 12, deptIds: [3], gender: '1', birthDate: '1996-10-02' })
    await tools.execute('update_form_draft', { operationId: 'user.delete', values: { id: 12 } })
    expect(execute).toHaveBeenLastCalledWith('prepare_delete_user', { id: 12 })
    expect(await tools.execute('update_form_draft', { operationId: 'user.delete', values: { id: 12, actorId: 1 } })).toMatchObject({ ok: false })
  })

  it('describes a native form using its existing metadata capability rather than the draft wrapper schema', async () => {
    const form = { editableFields: ['name'], fields: [{ name: 'name', required: true }] }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: form } }))
    const described = { ...capability, operation: { ...capability.operation!, describeCapability: 'describe_department' } }
    const tools = createOperationTools({ capabilities: [described, { ...capability, name: 'describe_department', riskLevel: 'read' }], execute })
    expect(await tools.execute('describe_operation', { operationId: 'department.create' })).toMatchObject({ ok: true, result: { data: { form } } })
    expect(execute).toHaveBeenCalledWith('describe_department', {})
    expect(await tools.execute('update_form_draft', { operationId: 'department.create', values: { draftVersion: 7 } })).toMatchObject({ ok: false })
  })
  it('discovers only authorized semantic operations and describes schema on demand', async () => {
    const execute = vi.fn()
    const tools = createOperationTools({ capabilities: [capability], execute })
    expect(tools.capabilities.map(c => c.name)).toEqual(['discover_operations', 'describe_operation', 'query_business_data', 'update_form_draft'])
    const found = await tools.execute('discover_operations', { keyword: '部门' })
    expect(found).toMatchObject({ ok: true, result: { data: { operations: [{ id: 'department.create', type: 'create' }] } } })
    expect(execute).not.toHaveBeenCalled()
    expect(await tools.execute('describe_operation', { operationId: 'department.create' })).toMatchObject({ ok: true, result: { data: { formKey: 'department.create', inputSchema: capability.inputSchema } } })
  })

  it('delegates draft changes through existing authorized execution without accepting arbitrary operations', async () => {
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: { draftId: 'd1' } } }))
    const tools = createOperationTools({ capabilities: [capability], execute })
    await tools.execute('update_form_draft', { operationId: 'department.create', values: { name: '研发部' } })
    expect(execute).toHaveBeenCalledWith('department_draft', { name: '研发部' })
    expect(await tools.execute('query_business_data', { operationId: 'department.create', params: {} })).toMatchObject({ ok: false })
    expect(await tools.execute('update_form_draft', { operationId: 'unknown', values: {} })).toMatchObject({ ok: false })
    expect(await tools.execute('update_form_draft', { operationId: 'department.create', values: {}, actorId: 1 })).toMatchObject({ ok: false })
  })
})
