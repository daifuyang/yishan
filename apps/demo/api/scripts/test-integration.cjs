const { spawnSync } = require('node:child_process')
const { dirname, join } = require('node:path')

const cli = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
const result = spawnSync(process.execPath, [cli, 'run', '--config', 'vitest.integration.config.ts'], {
  stdio: 'inherit', env: { ...process.env, YISHAN_DEMO_MYSQL_TEST: '1' },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
