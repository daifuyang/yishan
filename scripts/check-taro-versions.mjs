import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
const owners = ['apps/demo/app', 'packages/core/app', 'packages/ui']
const readManifest = file => JSON.parse(readFileSync(file, 'utf8'))

try {
  const appRequire = createRequire(join(root, owners[0], 'package.json'))
  const expected = readManifest(appRequire.resolve('@tarojs/cli/package.json')).version
  if (!/^4\.\d+\.\d+(?:[-+].*)?$/.test(expected)) {
    throw new Error(`Demo requires Taro 4; installed @tarojs/cli is ${expected}`)
  }

  const errors = []
  let checked = 0
  for (const owner of owners) {
    const file = join(root, owner, 'package.json')
    const manifest = readManifest(file)
    const require = createRequire(file)
    const dependencies = {
      ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies,
    }
    for (const name of Object.keys(dependencies).filter(name => name.startsWith('@tarojs/') || name === 'babel-preset-taro')) {
      try {
        // Inspect Node's resolved installation, including file: shims and pnpm peer contexts.
        const actual = readManifest(require.resolve(`${name}/package.json`)).version
        checked++
        if (actual !== expected) errors.push(`${owner}: ${name} installed ${actual}; expected ${expected}`)
      } catch (error) {
        errors.push(`${owner}: ${name} not installed or unreadable (${error.code ?? error.message})`)
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`Verified ${checked} installed Taro packages and local shim at ${expected}.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
