const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

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
  const keys = ['API_TARGET', 'YISHAN_API_TARGET', 'YISHAN_API_PORT', 'YISHAN_APP_API_BASE_URL', 'TARO_ENV', 'NODE_ENV']
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
  await withEnvironment({ TARO_ENV: 'h5', YISHAN_API_PORT: '4600' }, async () => {
    const config = await appConfig()((_empty, base) => base, {})
    const devConfig = loadTs('config/dev.ts', { '@yishan/demo-config': sharedConfig }).default
    assert.equal(config.defineConstants.__YISHAN_API_BASE_URL__, '""')
    assert.equal(config.h5.devServer.proxy[0].target, 'http://localhost:4600')
    assert.equal(devConfig.h5.devServer.proxy[0].target, 'http://localhost:4600')
  })
})
