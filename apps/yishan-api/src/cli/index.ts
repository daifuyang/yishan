#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { apiRequest, apiRequestFormData } from './http.js'
import { getEndpointInputSpec } from './openapi-introspect.js'
import { generateResourcesFromOpenApi } from './openapi-generator.js'
import { getResourceRegistry } from './resource-registry.js'
import { clearSession, readSession, saveSession } from './session.js'
import type { LoginResponseData, ResourceAction } from './types.js'

function printHelp(): void {
  console.log(`yishan-api-cli

用法:
  yishan-api-cli auth login -u <username> -p <password> [--base-url <url>]
  yishan-api-cli auth me
  yishan-api-cli auth refresh
  yishan-api-cli auth logout
  yishan-api-cli users list [--page 1] [--page-size 10] [--keyword xxx] [--status 1]
  yishan-api-cli resources
  yishan-api-cli api <resource> <action> [--id <id>] [--data '{"k":"v"}'] [--file <path>]
                  [--page 1] [--page-size 10] [--no-validate]
                  [--help-input] [--template] [--template-full]
  yishan-api-cli gen from-openapi [--base-url <url>]

环境变量:
  YISHAN_API_BASE_URL   默认 API 地址 (默认: http://127.0.0.1:3000)
`)
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {}
  for (let i = 0; i < args.length; i += 1) {
    const item = args[i]
    if (!item.startsWith('-')) continue
    const next = args[i + 1]
    if (next && !next.startsWith('-')) {
      options[item] = next
      i += 1
    } else {
      options[item] = 'true'
    }
  }
  return options
}

function getOption(options: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (options[key] !== undefined) {
      return options[key]
    }
  }
  return undefined
}

async function handleAuth(command: string, args: string[]): Promise<void> {
  const options = parseOptions(args)
  const session = await readSession()
  const baseUrl = getOption(options, ['--base-url'])
  if (baseUrl) {
    session.baseUrl = baseUrl
  }

  if (command === 'login') {
    const username = getOption(options, ['-u', '--username'])
    const password = getOption(options, ['-p', '--password'])
    if (!username || !password) {
      throw new Error('登录参数缺失: -u <username> -p <password>')
    }

    const result = await apiRequest<LoginResponseData>({
      session,
      path: '/api/v1/auth/login',
      method: 'POST',
      body: { username, password }
    })

    session.accessToken = result.data.token
    session.refreshToken = result.data.refreshToken
    session.user = result.data.userInfo
      ? {
          id: result.data.userInfo.id,
          username: result.data.userInfo.username,
          email: result.data.userInfo.email,
          roleIds: result.data.userInfo.roleIds
        }
      : undefined
    await saveSession(session)
    console.log(`登录成功: ${session.user?.username || username}`)
    return
  }

  if (command === 'me') {
    const result = await apiRequest<Record<string, unknown>>({
      session,
      path: '/api/v1/auth/me',
      requireAuth: true
    })
    console.log(JSON.stringify(result.data, null, 2))
    return
  }

  if (command === 'refresh') {
    if (!session.refreshToken) {
      throw new Error('当前无 refreshToken，请先登录')
    }
    const result = await apiRequest<{ accessToken: string; refreshToken: string }>({
      session,
      path: '/api/v1/auth/refresh',
      method: 'POST',
      body: { refreshToken: session.refreshToken }
    })
    session.accessToken = result.data.accessToken
    session.refreshToken = result.data.refreshToken
    await saveSession(session)
    console.log('令牌刷新成功')
    return
  }

  if (command === 'logout') {
    if (session.accessToken) {
      try {
        await apiRequest<null>({
          session,
          path: '/api/v1/auth/logout',
          method: 'POST',
          requireAuth: true
        })
      } catch (error) {
        console.warn(`远端登出失败，已清理本地会话: ${(error as Error).message}`)
      }
    }
    await clearSession()
    console.log('已退出登录')
    return
  }

  throw new Error(`不支持的 auth 子命令: ${command}`)
}

async function handleUsers(command: string, args: string[]): Promise<void> {
  const options = parseOptions(args)
  const session = await readSession()

  if (command !== 'list') {
    throw new Error(`不支持的 users 子命令: ${command}`)
  }

  const page = Number(getOption(options, ['--page']) || 1)
  const pageSize = Number(getOption(options, ['--page-size']) || 10)
  const keyword = getOption(options, ['--keyword'])
  const status = getOption(options, ['--status'])

  const result = await apiRequest<Array<Record<string, unknown>>>({
    session,
    path: '/api/v1/admin/users',
    query: { page, pageSize, keyword, status },
    requireAuth: true
  })

  const rows = result.data.map((item) => ({
    id: item.id,
    username: item.username,
    nickname: item.nickname,
    email: item.email,
    phone: item.phone,
    status: item.status
  }))

  console.table(rows)
  if (result.pagination) {
    console.log(
      `page=${result.pagination.page}, pageSize=${result.pagination.pageSize}, total=${result.pagination.total}, totalPages=${result.pagination.totalPages}`
    )
  }
}

function parseJsonOption(input: string | undefined): Record<string, unknown> {
  if (!input) return {}
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>
    return parsed
  } catch {
    throw new Error('--data 必须是合法 JSON 字符串')
  }
}

function ensureRequiredFields(payload: Record<string, unknown>, required: string[], scope: string): void {
  const missing = required.filter((key) => payload[key] === undefined)
  if (missing.length > 0) {
    throw new Error(`${scope} 缺少必填字段: ${missing.join(', ')}`)
  }
}

function printInputSpec(inputSpec: NonNullable<Awaited<ReturnType<typeof getEndpointInputSpec>>>): void {
  console.log(`operationId: ${inputSpec.operationId || '-'}`)
  console.log(`query required: ${inputSpec.queryRequired.join(', ') || '-'}`)
  console.log(`query optional: ${inputSpec.queryOptional.join(', ') || '-'}`)
  if (inputSpec.hasBody) {
    console.log(`body required: ${inputSpec.bodyRequired.join(', ') || '-'}`)
    console.log(`body optional: ${inputSpec.bodyOptional.join(', ') || '-'}`)
    const fields = Object.entries(inputSpec.bodyProperties).map(([name, info]) => ({
      field: name,
      type: info.type || '-',
      required: inputSpec.bodyRequired.includes(name) ? 'yes' : 'no',
      description: info.description || ''
    }))
    if (fields.length > 0) {
      console.table(fields)
    }
  } else {
    console.log('body: -')
  }
}

function printTemplate(inputSpec: NonNullable<Awaited<ReturnType<typeof getEndpointInputSpec>>>): void {
  if (!inputSpec.hasBody) {
    console.log('该接口无 body 模板')
    return
  }

  const pickDefault = (field: { type?: string; default?: unknown; enum?: unknown[] }): unknown => {
    if (field.default !== undefined) return field.default
    if (field.enum && field.enum.length > 0) return field.enum[0]
    if (field.type === 'number' || field.type === 'integer') return 0
    if (field.type === 'boolean') return false
    if (field.type === 'array') return []
    if (field.type === 'object') return {}
    return ''
  }

  const template: Record<string, unknown> = {}
  for (const key of inputSpec.bodyRequired) {
    const info = inputSpec.bodyProperties[key] || {}
    template[key] = pickDefault(info)
  }
  console.log(JSON.stringify(template, null, 2))
}

function printFullTemplate(inputSpec: NonNullable<Awaited<ReturnType<typeof getEndpointInputSpec>>>): void {
  if (!inputSpec.hasBody) {
    console.log('该接口无 body 模板')
    return
  }

  const pickDefault = (field: { type?: string; default?: unknown; enum?: unknown[] }): unknown => {
    if (field.default !== undefined) return field.default
    if (field.enum && field.enum.length > 0) return field.enum[0]
    if (field.type === 'number' || field.type === 'integer') return 0
    if (field.type === 'boolean') return false
    if (field.type === 'array') return []
    if (field.type === 'object') return {}
    return ''
  }

  const template: Record<string, unknown> = {}
  for (const key of inputSpec.bodyRequired) {
    const info = inputSpec.bodyProperties[key] || {}
    template[key] = pickDefault(info)
  }
  for (const key of inputSpec.bodyOptional) {
    const info = inputSpec.bodyProperties[key] || {}
    template[key] = pickDefault(info)
  }
  console.log(JSON.stringify(template, null, 2))
}

async function handleApi(resource: string, actionRaw: string, args: string[]): Promise<void> {
  const action = actionRaw as ResourceAction
  const options = parseOptions(args)
  const session = await readSession()
  const registry = getResourceRegistry()
  const spec = registry.find((item) => item.resource === resource)
  if (!spec) {
    throw new Error(`资源不存在: ${resource}，可先运行 yishan-api-cli resources 查看`) 
  }

  const endpoint = spec.endpoints[action]
  if (!endpoint) {
    throw new Error(`资源 ${resource} 不支持动作 ${action}`)
  }

  const id = getOption(options, ['--id'])
  if (endpoint.requireId && !id) {
    throw new Error(`动作 ${action} 需要 --id`) 
  }

  const page = getOption(options, ['--page'])
  const pageSize = getOption(options, ['--page-size'])
  const keyword = getOption(options, ['--keyword'])
  const status = getOption(options, ['--status'])
  const body = parseJsonOption(getOption(options, ['--data']))
  const filePath = getOption(options, ['--file'])

  const queryPayload: Record<string, unknown> = {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    keyword,
    status
  }

  const inputSpec = await getEndpointInputSpec({
    baseUrl: session.baseUrl,
    path: endpoint.path,
    method: endpoint.method
  })

  if (getOption(options, ['--help-input']) === 'true') {
    if (!inputSpec) {
      console.log('未找到该接口的 OpenAPI 输入定义')
      return
    }
    printInputSpec(inputSpec)
    return
  }

  if (getOption(options, ['--template']) === 'true') {
    if (!inputSpec) {
      console.log('未找到该接口的 OpenAPI 输入定义')
      return
    }
    printTemplate(inputSpec)
    return
  }

  if (getOption(options, ['--template-full']) === 'true') {
    if (!inputSpec) {
      console.log('未找到该接口的 OpenAPI 输入定义')
      return
    }
    printFullTemplate(inputSpec)
    return
  }

  const validateInput = getOption(options, ['--no-validate']) !== 'true'
  if (validateInput && inputSpec) {
      if (endpoint.method === 'GET') {
        ensureRequiredFields(queryPayload, inputSpec.queryRequired, 'query 参数')
      }
      if (inputSpec.hasBody && endpoint.method !== 'GET' && endpoint.method !== 'DELETE') {
        ensureRequiredFields(body, inputSpec.bodyRequired, 'body')
      }
  }

  const path = endpoint.path.replace(':id', id || '')
  let result: Awaited<ReturnType<typeof apiRequest<unknown>>>
  if (filePath) {
    if (endpoint.method !== 'POST' && endpoint.method !== 'PUT') {
      throw new Error('--file 仅支持 POST/PUT 请求')
    }
    const buf = await readFile(filePath)
    const blob = new Blob([buf])
    const formData = new FormData()
    formData.append('file', blob, basename(filePath))
    result = await apiRequestFormData<unknown>({
      session,
      path,
      method: endpoint.method,
      formData,
      query: {
        folderId: getOption(options, ['--folder-id']),
        kind: getOption(options, ['--kind']),
        name: getOption(options, ['--name'])
      },
      requireAuth: true
    })
  } else {
    result = await apiRequest<unknown>({
      session,
      path,
      method: endpoint.method,
      body: endpoint.method === 'GET' || endpoint.method === 'DELETE' ? undefined : body,
      query: endpoint.method === 'GET' ? {
        page: queryPayload.page as number | undefined,
        pageSize: queryPayload.pageSize as number | undefined,
        keyword: queryPayload.keyword as string | undefined,
        status: queryPayload.status as string | undefined
      } : undefined,
      requireAuth: true
    })
  }

  if (Array.isArray(result.data)) {
    console.table(result.data as Array<Record<string, unknown>>)
  } else {
    console.log(JSON.stringify(result.data, null, 2))
  }

  if (result.pagination) {
    console.log(
      `page=${result.pagination.page}, pageSize=${result.pagination.pageSize}, total=${result.pagination.total}, totalPages=${result.pagination.totalPages}`
    )
  }
}

function printResources(): void {
  const resources = getResourceRegistry().map((item) => ({
    resource: item.resource,
    actions: Object.keys(item.endpoints).join(', '),
    description: item.description || '',
    sample: `yishan-api-cli api ${item.resource} ${Object.keys(item.endpoints)[0] || 'list'}`
  }))
  console.table(resources)
}

async function handleGenerate(command: string, args: string[]): Promise<void> {
  if (command !== 'from-openapi') {
    throw new Error(`不支持的 gen 子命令: ${command}`)
  }
  const options = parseOptions(args)
  const session = await readSession()
  const baseUrl = getOption(options, ['--base-url']) || session.baseUrl
  const result = await generateResourcesFromOpenApi(baseUrl)
  console.log(`生成完成: ${result.count} 个资源，输出文件 ${result.outputPath}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp()
    return
  }

  const [resource, command, ...rest] = args

  if (!resource) {
    printHelp()
    return
  }

  if (resource === 'resources') {
    printResources()
    return
  }

  if (!command) {
    printHelp()
    return
  }

  if (resource === 'auth') {
    await handleAuth(command, rest)
    return
  }

  if (resource === 'users') {
    await handleUsers(command, rest)
    return
  }

  if (resource === 'api') {
    if (!command || rest.length === 0) {
      throw new Error('用法: yishan-api-cli api <resource> <action> [--id] [--data]')
    }
    const [action, ...actionArgs] = rest
    if (!action) {
      throw new Error('缺少 action 参数')
    }
    await handleApi(command, action, actionArgs)
    return
  }

  if (resource === 'gen') {
    await handleGenerate(command, rest)
    return
  }

  throw new Error(`不支持的命令: ${resource}`)
}

main().catch((error) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
