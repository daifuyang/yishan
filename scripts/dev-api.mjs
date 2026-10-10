import { watch } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function createBuildQueue(build, restart) {
  let pending = false
  let running
  return { request() {
    pending = true
    if (!running) running = (async () => {
      while (pending) {
        pending = false
        if (await build()) await restart()
      }
    })().finally(() => { running = undefined })
    return running
  } }
}

export async function devApi({ once = false } = {}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const appRoot = join(root, 'apps/demo/api')
  const watchers = []
  let server
  let compiler
  let timer
  let stopped = false
  const terminate = async child => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return
    const exited = new Promise(resolve => child.once('exit', resolve))
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill('SIGTERM')
    await exited
  }
  const queue = createBuildQueue(async () => {
    if (stopped) return false
    console.log('[dev-api] rebuilding Core and Demo from source')
    const args = ['-r', '--filter', '@yishan/demo-api...', 'build']
    const pnpmScript = process.env.npm_execpath
    compiler = pnpmScript ? spawn(process.execPath, [pnpmScript, ...args], { cwd: root, stdio: 'inherit', windowsHide: true })
      : spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true })
    const succeeded = await new Promise((resolve, reject) => { compiler.once('error', reject); compiler.once('exit', code => resolve(code === 0)) })
    compiler = undefined
    if (!succeeded) console.error('[dev-api] build failed; waiting for the next source change')
    if (!succeeded && once) process.exitCode = 1
    return succeeded && !stopped
  }, async () => {
    await terminate(server)
    if (!once && !stopped) server = spawn(process.execPath, ['dist/main.js'], { cwd: appRoot, stdio: 'inherit', windowsHide: true })
  })
  const close = async () => {
    stopped = true
    clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
    await Promise.all([terminate(compiler), terminate(server)])
  }
  process.once('SIGINT', () => { void close() })
  process.once('SIGTERM', () => { void close() })
  if (!once) for (const directory of ['packages/core/api', 'packages/core/contracts', 'packages/core/database', 'packages/core/system-api', 'apps/demo/api']) {
    watchers.push(watch(join(root, directory), { recursive: true }, (_event, filename) => {
      const file = filename?.toString().replace(/\\/g, '/')
      if (!file || /^(src\/|scripts\/|package\.json$|tsconfig(?:\.[^/]+)?\.json$)/.test(file)) {
        clearTimeout(timer)
        timer = setTimeout(() => { void queue.request().catch(error => console.error(error)) }, 150)
      }
    }))
  }
  await queue.request()
  if (once) await close()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await devApi({ once: process.argv.includes('--once') })
