const assert = require('node:assert/strict')
const test = require('node:test')
const { createRequire } = require('node:module')
const { loadTs } = require('./helpers/load-ts.cjs')

const cliRequire = createRequire(require.resolve('@tarojs/cli/package.json'))
const serviceRequire = createRequire(cliRequire.resolve('@tarojs/service/package.json'))
const { merge } = serviceRequire('webpack-merge')
const runnerRequire = createRequire(require.resolve('@tarojs/webpack5-runner/package.json'))
const DevServer = runnerRequire('webpack-dev-server')

const sharedConfig = loadTs(require.resolve('@yishan/demo-config'))

test('API target resolver uses caller defaults without mutating supplied environment', () => {
  const env = Object.freeze({})
  assert.equal(sharedConfig.resolveApiTarget('https://first.example.test:4100', env), 'https://first.example.test:4100')
  assert.equal(sharedConfig.resolveApiTarget('http://second.example.test:5100', env), 'http://second.example.test:5100')
  assert.deepEqual(env, {})
})

test('explicit API targets win over legacy aliases and port-only overrides', () => {
  assert.equal(sharedConfig.resolveApiTarget('http://fallback.example.test:3100', {
    API_TARGET: 'https://preferred.example.test/api',
    YISHAN_API_TARGET: 'https://legacy.example.test',
    YISHAN_API_PORT: '4200',
  }), 'https://preferred.example.test/api')
  assert.equal(sharedConfig.resolveApiTarget('http://fallback.example.test:3100', {
    YISHAN_API_TARGET: 'https://legacy.example.test',
    YISHAN_API_PORT: '4200',
  }), 'https://legacy.example.test')
})

test('port override preserves caller protocol, host and pathname', () => {
  assert.equal(sharedConfig.resolveApiTarget('https://custom.example.test:5100/api', {
    YISHAN_API_PORT: '4300',
  }), 'https://custom.example.test:4300/api')
  assert.equal(sharedConfig.resolveApiTarget('http://localhost:3100', {
    API_TARGET: ' ', YISHAN_API_TARGET: '', YISHAN_API_PORT: '4400',
  }), 'http://localhost:4400')
})

test('invalid port-only overrides fail rather than silently choosing another target', () => {
  for (const port of ['0', '-1', '65536', 'abc', '3.5']) {
    assert.throws(() => sharedConfig.resolveApiTarget('http://localhost:3100', { YISHAN_API_PORT: port }), /YISHAN_API_PORT/)
  }
})

async function withEnvironment(values, run) {
  const keys = ['API_TARGET', 'YISHAN_API_TARGET', 'YISHAN_API_PORT', 'YISHAN_APP_API_BASE_URL', 'TARO_ENV', 'NODE_ENV', 'YISHAN_H5_ALLOWED_HOSTS', 'YISHAN_H5_HOST']
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
  try { return await run() } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

function appConfig() {
  return loadTs('config/index.ts', {
    '@yishan/demo-config': sharedConfig,
    '@tarojs/cli': { defineConfig: (configuration) => configuration },
  }).default
}

test('mini-program keeps its local fallback and explicit gateway override', async () => {
  await withEnvironment({ TARO_ENV: 'weapp' }, async () => {
    const config = await appConfig()((_empty, base) => base, {})
    assert.equal(config.defineConstants.__YISHAN_API_BASE_URL__, '"http://localhost:3100"')
  })
  await withEnvironment({ TARO_ENV: 'weapp', YISHAN_APP_API_BASE_URL: 'https://gateway.example.test/' }, async () => {
    const config = await appConfig()((_empty, base) => base, {})
    assert.equal(config.defineConstants.__YISHAN_API_BASE_URL__, '"https://gateway.example.test"')
  })
})

test('H5 keeps same-origin requests while both development proxy configs honor API overrides', async () => {
  await withEnvironment({ TARO_ENV: 'h5', NODE_ENV: 'development', YISHAN_API_PORT: '4600' }, async () => {
    const config = await appConfig()(merge, {})
    const devConfig = loadTs('config/dev.ts', { '@yishan/demo-config': sharedConfig }).default
    assert.equal(config.defineConstants.__YISHAN_API_BASE_URL__, '""')
    assert.equal(config.h5.devServer.proxy[0].target, 'http://localhost:4600')
    assert.equal(devConfig.h5.devServer.proxy[0].target, 'http://localhost:4600')
  })
})

test('merged H5 development config accepts local and existing proxy hosts but rejects unknown domains', async () => {
  await withEnvironment({ TARO_ENV: 'h5', NODE_ENV: 'development' }, async () => {
    const config = await appConfig()(merge, {})
    assert.equal(config.h5.devServer.host, '127.0.0.1')
    assert.equal(config.h5.devServer.port, 21003)
    assert.equal(config.h5.devServer.proxy.length, 1)
    const server = Object.create(DevServer.prototype)
    server.options = config.h5.devServer
    for (const host of ['localhost:21003', '127.0.0.1:21003', '[::1]:21003', 'debug.daifuyang.com']) {
      assert.equal(server.checkHeader({ host }, 'host'), true, host)
    }
    assert.equal(server.checkHeader({ host: 'untrusted.example.test' }, 'host'), false)
  })
})

test('explicit development host lists extend the proxy allowlist without opening arbitrary hosts', async () => {
  await withEnvironment({ TARO_ENV: 'h5', NODE_ENV: 'development', YISHAN_H5_ALLOWED_HOSTS: ' preview.example.test, tunnel.example.test , ', YISHAN_H5_HOST: '0.0.0.0' }, async () => {
    const config = await appConfig()(merge, {})
    assert.equal(config.h5.devServer.host, '0.0.0.0')
    const server = Object.create(DevServer.prototype)
    server.options = config.h5.devServer
    assert.equal(server.checkHeader({ host: 'preview.example.test' }, 'host'), true)
    assert.equal(server.checkHeader({ host: 'tunnel.example.test' }, 'host'), true)
    assert.equal(server.checkHeader({ host: 'debug.daifuyang.com' }, 'host'), true)
    assert.equal(server.checkHeader({ host: 'other.example.test' }, 'host'), false)
  })
})

test('unsafe or malformed development host entries fail rather than disabling host validation', async () => {
  for (const host of ['all', 'auto', '*', '*.example.test', '.example.test', 'https://example.test', 'example.test:21003', 'example.test/path']) {
    await withEnvironment({ NODE_ENV: 'development', YISHAN_H5_ALLOWED_HOSTS: host }, async () => {
      await assert.rejects(async () => appConfig()(merge, {}), /YISHAN_H5_ALLOWED_HOSTS/)
    })
  }
})

test('merged production configs omit devServer and retain shared compilation inputs and API constants', async () => {
  for (const target of ['h5', 'weapp']) {
    await withEnvironment({ TARO_ENV: target, NODE_ENV: 'production', YISHAN_APP_API_BASE_URL: 'https://api.example.test/' }, async () => {
      const config = await appConfig()(merge, {})
      assert.equal(config.h5.devServer, undefined)
      assert.equal(config.defineConstants.__YISHAN_API_BASE_URL__, '"https://api.example.test"')
      assert.equal(config.outputRoot, `dist/${target}`)
      for (const sources of [config.h5.compile.include, config.mini.compile.include]) {
        assert.equal(sources.length, 2)
        assert.ok(sources.every(require('node:fs').existsSync))
      }
    })
  }
})

test('production builds ignore development-only host overrides', async () => {
  await withEnvironment({ NODE_ENV: 'production', YISHAN_H5_ALLOWED_HOSTS: 'all' }, async () => {
    const config = await appConfig()(merge, {})
    assert.equal(config.h5.devServer, undefined)
  })
})
