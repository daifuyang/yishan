const { spawn } = require('node:child_process')

const mode = process.argv[2] || 'dev'
const child = spawn(process.execPath, [require.resolve('@umijs/max/bin/max.js'), 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, UMI_ENV: mode, PORT: process.env.ADMIN_PORT || process.env.PORT || '8000', MOCK: 'none' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
