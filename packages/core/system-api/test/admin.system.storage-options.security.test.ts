import Fastify from 'fastify'
import adminSystemOptionsPlugin from '../src/core/routes/api/v1/admin/system/options/index.ts'
import adminSystemStoragePlugin from '../src/core/routes/api/v1/admin/system/storage/index.ts'
import registerSystemSchemas from '../src/core/schemas/system.ts'
import { errorHandlerPlugin as errorHandlerPlugin } from '@yishan/core-api/plugins'
import { describe, it, expect, vi, beforeEach } from './runtime-fixture'
import { SystemOptionService } from '../src/core/services/system-option.service.ts'
import { StorageConfigService } from '../src/core/services/storage-config.service.ts'

async function buildAppWithOptions() {
  const app = Fastify({ logger: false });
    // 单测不需要真实 RBAC 校验：no-op 占位。
    app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
    app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)
    app.decorate('authenticate', async () => undefined)
  await app.register(errorHandlerPlugin)
  registerSystemSchemas(app)
  await app.register(adminSystemOptionsPlugin)
  await app.ready()
  return app
}

async function buildAppWithStorage() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  // 单测不需要真实 RBAC 校验：no-op 占位。
  app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
  app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)
  app.decorate('authenticate', async () => undefined)
  registerSystemSchemas(app)
  await app.register(adminSystemStoragePlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin system secret redaction', () => {
  it('GET /qiniuConfig 不应返回 secretKey', async () => {
    const app = await buildAppWithOptions()

    vi.spyOn(SystemOptionService, 'getOption').mockResolvedValue(
      JSON.stringify({ accessKey: 'ak', secretKey: 'sk', bucket: 'b', region: 'z0' })
    )

    const res = await app.inject({ method: 'GET', url: '/qiniuConfig' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    const dataObj = JSON.parse(body.data)
    expect(dataObj.secretKey).toBeUndefined()

    await app.close()
  })

  it('GET /query 批量获取时 qiniuConfig 不应返回 secretKey', async () => {
    const app = await buildAppWithOptions()

    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      qiniuConfig: JSON.stringify({ accessKey: 'ak', secretKey: 'sk', bucket: 'b', region: 'z0' }),
      basicConfig: '{}',
    } as any)

    const res = await app.inject({ method: 'GET', url: '/query?key[]=qiniuConfig&key[]=basicConfig' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    const results = body.data.results as Array<{ key: string; value: string | null }>
    const qiniu = results.find(r => r.key === 'qiniuConfig')
    expect(qiniu).toBeTruthy()
    const qiniuObj = JSON.parse(qiniu!.value as string)
    expect(qiniuObj.secretKey).toBeUndefined()

    await app.close()
  })

  it('GET /config 不应返回七牛 secretKey', async () => {
    const app = await buildAppWithStorage()

    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '1',
      qiniuConfig: JSON.stringify({ accessKey: 'ak', secretKey: 'sk', bucket: 'b', region: 'z0' }),
      aliyunOssConfig: '',
    } as any)

    const res = await app.inject({ method: 'GET', url: '/config' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.qiniu.secretKey).toBeUndefined()

    await app.close()
  })

  it('importConfig 未传 secretKey 时应保留旧值', async () => {
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '1',
      qiniuConfig: JSON.stringify({ accessKey: 'ak', secretKey: 'old', bucket: 'b', region: 'z0' }),
      aliyunOssConfig: '',
    } as any)

    const setSpy = vi.spyOn(SystemOptionService, 'setOption').mockResolvedValue('ok' as any)

    await StorageConfigService.importConfig(
      { provider: 'qiniu', qiniu: { accessKey: 'ak2', bucket: 'b2', region: 'z0' } },
      1
    )

    const qiniuCall = setSpy.mock.calls.find(c => c[0] === 'qiniuConfig')
    expect(qiniuCall).toBeTruthy()
    const stored = JSON.parse(qiniuCall![1])
    expect(stored.accessKey).toBe('ak2')
    expect(stored.bucket).toBe('b2')
    expect(stored.secretKey).toBe('old')
  })

  it('importConfig 传入 secretKey 时应覆盖旧值', async () => {
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '1',
      qiniuConfig: JSON.stringify({ accessKey: 'ak', secretKey: 'old', bucket: 'b', region: 'z0' }),
      aliyunOssConfig: '',
    } as any)

    const setSpy = vi.spyOn(SystemOptionService, 'setOption').mockResolvedValue('ok' as any)

    await StorageConfigService.importConfig(
      { provider: 'qiniu', qiniu: { accessKey: 'ak2', secretKey: 'new', bucket: 'b', region: 'z0' } },
      1
    )

    const qiniuCall = setSpy.mock.calls.find(c => c[0] === 'qiniuConfig')
    expect(qiniuCall).toBeTruthy()
    const stored = JSON.parse(qiniuCall![1])
    expect(stored.secretKey).toBe('new')
  })
})

describe('Aliyun OSS secret redaction', () => {
  const ossStored = { accessKeyId: 'id', accessKeySecret: 'oss-secret', bucket: 'b', region: 'oss-cn-hangzhou' }

  it('GET /config 不应返回 OSS accessKeySecret', async () => {
    const app = await buildAppWithStorage()
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '2', qiniuConfig: '', aliyunOssConfig: JSON.stringify(ossStored),
    } as any)
    const res = await app.inject({ method: 'GET', url: '/config' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.aliyunOss.accessKeyId).toBe('id')
    expect(res.json().data.aliyunOss.accessKeySecret).toBeUndefined()
    await app.close()
  })

  it('GET /export 不应返回 OSS accessKeySecret', async () => {
    const app = await buildAppWithStorage()
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '2', qiniuConfig: '', aliyunOssConfig: JSON.stringify(ossStored),
    } as any)
    const res = await app.inject({ method: 'GET', url: '/export' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.aliyunOss.accessKeySecret).toBeUndefined()
    await app.close()
  })

  it('options 通道读取 aliyunOssConfig 不应返回 accessKeySecret', async () => {
    const app = await buildAppWithOptions()
    vi.spyOn(SystemOptionService, 'getOption').mockResolvedValue(JSON.stringify(ossStored))
    const single = await app.inject({ method: 'GET', url: '/aliyunOssConfig' })
    expect(JSON.parse(single.json().data).accessKeySecret).toBeUndefined()
    const batch = await app.inject({ method: 'GET', url: '/query?key[]=aliyunOssConfig' })
    const value = batch.json().data.results.find((r: { key: string }) => r.key === 'aliyunOssConfig').value
    expect(JSON.parse(value).accessKeySecret).toBeUndefined()
    await app.close()
  })
})

describe('Storage connection test', () => {
  it('OSS 草稿密钥留空时使用已存密钥签名，并返回 bucket 与耗时', async () => {
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({
      systemStorage: '2', qiniuConfig: '',
      aliyunOssConfig: JSON.stringify({ accessKeyId: 'id', accessKeySecret: 'stored-secret', bucket: 'old', region: 'oss-cn-hangzhou' }),
    } as any)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<BucketInfo/>', { status: 200 }))
    const app = await buildAppWithStorage()
    const res = await app.inject({
      method: 'POST', url: '/test',
      payload: { provider: 'aliyunOss', aliyunOss: { accessKeyId: 'id', accessKeySecret: '', bucket: 'draft', region: 'oss-cn-hangzhou' } },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data).toMatchObject({ ok: true, provider: 'aliyunOss', bucket: 'draft' })
    expect(typeof data.latencyMs).toBe('number')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://draft.oss-cn-hangzhou.aliyuncs.com/?bucketInfo')
    const headers = init.headers as Record<string, string>
    const { createHmac } = await import('node:crypto')
    const expected = createHmac('sha1', 'stored-secret').update(`GET


${headers.Date}
/draft/?bucketInfo`).digest('base64')
    expect(headers.Authorization).toBe(`OSS id:${expected}`)
    await app.close()
  })

  it('服务商拒绝时返回 ok=false 与可读原因，而不是接口错误', async () => {
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({ systemStorage: '0', qiniuConfig: '', aliyunOssConfig: '' } as any)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<Error><Code>InvalidAccessKeyId</Code><Message>bad</Message></Error>', { status: 403 })
    )
    const result = await StorageConfigService.testConnection({
      provider: 'aliyunOss', aliyunOss: { accessKeyId: 'id', accessKeySecret: 's', bucket: 'b', region: 'cn-hangzhou' },
    })
    expect(result).toMatchObject({ ok: false, bucket: 'b', message: 'AccessKeyId 或 AccessKeySecret 不正确' })
  })

  it('草稿不完整或未启用时直接返回校验错误，不发起网络请求', async () => {
    vi.spyOn(SystemOptionService, 'getOptions').mockResolvedValue({ systemStorage: '0', qiniuConfig: '', aliyunOssConfig: '' } as any)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const app = await buildAppWithStorage()
    const incomplete = await app.inject({ method: 'POST', url: '/test', payload: { provider: 'qiniu', qiniu: { accessKey: 'ak', bucket: 'b', region: 'z0' } } })
    expect(incomplete.statusCode).toBe(400)
    const disabled = await app.inject({ method: 'POST', url: '/test', payload: { provider: 'disabled' } })
    expect(disabled.statusCode).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    await app.close()
  })
})
