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
  it('does not add saved or successful presentation facts to rejected execution', async () => {
    const tools = createOperationTools({ capabilities: [capability], execute: async () => ({ ok: false, error: '草稿版本冲突' }) })
    expect(await tools.execute('update_form_draft', { operationId: 'department.create', values: { name: '研发' } })).toEqual({ ok: false, error: '草稿版本冲突' })
  })
  it('discovers declared business aliases without widening the authorized catalog', async () => {
    const registered = { ...capability, operation: { ...capability.operation!, aliases: ['新建部门', '新增部门'], presentation: { kind: 'draft' as const, subject: '新增部门' } } }
    const tools = createOperationTools({ capabilities: [registered], execute: vi.fn() })
    expect(await tools.execute('discover_operations', { keyword: '新建部门' })).toMatchObject({
      ok: true, result: { data: { operations: [{ id: 'department.create' }] }, progress: { action: 'discover', kind: 'operations', outcome: 'ready', count: 1 } },
    })
    expect(await tools.execute('discover_operations', { keyword: '新建用户' })).toMatchObject({
      ok: true, result: { progress: { outcome: 'empty', count: 0 } },
    })
  })

  it('returns tool-owned form semantics and derives draft labels from the registered schema, never model display text', async () => {
    const registered = { ...capability, operation: { ...capability.operation!, presentation: { kind: 'draft' as const, subject: '新增部门' } }, inputSchema: Type.Object({ name: Type.String({ title: '部门名称' }) }) }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: { draftId: 'd1' }, mutated: false } }))
    const tools = createOperationTools({ capabilities: [registered], execute })
    expect(await tools.execute('describe_operation', { operationId: 'department.create' })).toMatchObject({
      ok: true, result: { progress: { action: 'describe', kind: 'form', subject: '新增部门', outcome: 'ready' } },
    })
    expect(await tools.execute('update_form_draft', { operationId: 'department.create', values: { name: '任意用户内容' } })).toMatchObject({
      ok: true, result: { progress: { action: 'draft', kind: 'draft', subject: '新增部门', outcome: 'saved', fieldLabels: ['部门名称'] } },
    })
  })
  it('normalizes safe numeric text from model arguments without coercing numeric ids or mutating the input', async () => {
    const userDraft = { ...capability, inputSchema: Type.Object({ phone: Type.Optional(Type.String()), deptIds: Type.Optional(Type.Array(Type.Number())) }, { additionalProperties: false }) }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: {} } }))
    const tools = createOperationTools({ capabilities: [userDraft], execute })
    const values = { phone: 13900001021, deptIds: [10] }
    await tools.execute('update_form_draft', { operationId: 'department.create', values })
    expect(execute).toHaveBeenLastCalledWith('department_draft', { phone: '13900001021', deptIds: [10] })
    expect(values.phone).toBe(13900001021)
  })
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
  it('includes the declared input types alongside form metadata so numeric-looking text is not guessed', async () => {
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: { fields: [{ name: 'phone', label: '手机号' }] } } }))
    const inputSchema = Type.Object({ phone: Type.Optional(Type.String()) })
    const described = { ...capability, inputSchema, operation: { ...capability.operation!, describeCapability: 'describe_department' } }
    const tools = createOperationTools({ capabilities: [described, { ...capability, name: 'describe_department', riskLevel: 'read' }], execute })
    expect(await tools.execute('describe_operation', { operationId: 'department.create' })).toMatchObject({ ok: true, result: { data: { inputSchema } } })
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

  it('coerces digit-only numeric text in query params so a model-written pageSize is not rejected as "Expected integer"', async () => {
    const listUsers = {
      ...capability,
      name: 'list_users',
      riskLevel: 'read' as const,
      inputSchema: Type.Object({ page: Type.Optional(Type.Integer()), pageSize: Type.Optional(Type.Integer()), keyword: Type.Optional(Type.String()) }),
      operation: { id: 'user.list', name: '查询用户', type: 'query' as const },
    }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: {} } }))
    const tools = createOperationTools({ capabilities: [listUsers], execute })
    await tools.execute('query_business_data', { operationId: 'user.list', params: { page: '2', pageSize: '20', keyword: '张三' } })
    expect(execute).toHaveBeenLastCalledWith('list_users', { page: 2, pageSize: 20, keyword: '张三' })
  })

  it('keeps non-numeric text and string-typed fields untouched while coercing numeric fields', async () => {
    const listUsers = {
      ...capability,
      name: 'list_users',
      riskLevel: 'read' as const,
      inputSchema: Type.Object({ pageSize: Type.Optional(Type.Integer()), status: Type.Optional(Type.String()), id: Type.Optional(Type.String()) }),
      operation: { id: 'user.list', name: '查询用户', type: 'query' as const },
    }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: {} } }))
    const tools = createOperationTools({ capabilities: [listUsers], execute })
    await tools.execute('query_business_data', { operationId: 'user.list', params: { pageSize: '20', status: '1', id: '20' } })
    expect(execute).toHaveBeenLastCalledWith('list_users', { pageSize: 20, status: '1', id: '20' })
  })

  it('refuses lossy numeric coercion: a decimal string for an integer field stays a string', async () => {
    const listUsers = {
      ...capability,
      name: 'list_users',
      riskLevel: 'read' as const,
      inputSchema: Type.Object({ pageSize: Type.Optional(Type.Integer()) }),
      operation: { id: 'user.list', name: '查询用户', type: 'query' as const },
    }
    const execute = vi.fn(async () => ({ ok: true as const, result: { data: {} } }))
    const tools = createOperationTools({ capabilities: [listUsers], execute })
    await tools.execute('query_business_data', { operationId: 'user.list', params: { pageSize: '20.5' } })
    expect(execute).toHaveBeenLastCalledWith('list_users', { pageSize: '20.5' })
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
