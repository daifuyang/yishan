import Fastify from 'fastify'
import adminSystemOptionsPlugin from '../src/routes/api/v1/admin/system/options/index.ts'
import adminSystemStoragePlugin from '../src/routes/api/v1/admin/system/storage/index.ts'
import registerSystemSchemas from '../src/schemas/system.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SystemOptionService } from '../src/services/system-option.service.ts'
import { StorageConfigService } from '../src/services/storage-config.service.ts'

async function buildAppWithOptions() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  registerSystemSchemas(app)
  await app.register(adminSystemOptionsPlugin)
  await app.ready()
  return app
}

async function buildAppWithStorage() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
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

