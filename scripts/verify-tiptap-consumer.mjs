import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = join(repository, 'packages/yishan-tiptap')
const pnpmCli = process.env.npm_execpath
if (!pnpmCli) throw new Error('Run this verifier via pnpm verify:tiptap')
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: pnpm verify:tiptap [--output <new external directory>]')
let output
if (args.length) {
  output = resolve(args[1])
  const location = relative(repository, output)
  const external = location === '..' || location.startsWith('..' + sep) || isAbsolute(location)
  if (!external) throw new Error('Consumer verification must run outside the repository')
  await mkdir(output) // Never overwrite or delete a caller-owned directory.
} else output = await mkdtemp(join(tmpdir(), 'yishan-tiptap-consumer-'))

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(command + ' exited ' + result.status)
}
const pnpm = (args, cwd) => run(process.execPath, [pnpmCli, ...args], cwd)
// Reuse the package's existing prepack (Rollup + verify:package).
pnpm(['pack', '--pack-destination', output], packageRoot)
const archives = (await readdir(output)).filter(file => file.endsWith('.tgz'))
assert.equal(archives.length, 1)
const archive = join(output, archives[0])
const listing = spawnSync('tar', ['-tf', archive], { encoding: 'utf8' })
if (listing.error) throw listing.error
assert.equal(listing.status, 0, listing.stderr)
const files = listing.stdout.trim().split(/\r?\n/)
for (const file of files) assert.match(file, /^package\/(?:dist\/.+|README\.md|LICENSE|package\.json)$/)
assert.ok(files.every(file => !/\.map$|(?:^|\/)(?:src|node_modules|\.env[^/]*)(?:\/|$)/.test(file)), 'tarball contains source, environment, map or linked dependencies')

for (const matrix of [
  { react: '18.3.1', types: '18.3.27', domTypes: '18.3.7' },
  { react: '19.2.0', types: '19.2.17', domTypes: '19.2.3' },
]) {
  const directory = join(output, 'react-' + matrix.react)
  await mkdir(directory)
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    name: 'tiptap-distribution-fixture', private: true, type: 'module',
    dependencies: { '@yishan/tiptap': 'file:' + archive, react: matrix.react, 'react-dom': matrix.react },
    devDependencies: { '@types/react': matrix.types, '@types/react-dom': matrix.domTypes },
  }, null, 2) + '\n')
  pnpm(['install', '--ignore-workspace', '--no-frozen-lockfile', '--config.node-linker=hoisted', '--strict-peer-dependencies'], directory)
  await writeFile(join(directory, 'consumer.mjs'), [
    "import assert from 'node:assert/strict'",
    "import { createRequire } from 'node:module'",
    "import { FormEditor, TiptapLocaleProvider, useTiptapLocale } from '@yishan/tiptap'",
    "import React from 'react'",
    "import { renderToString } from 'react-dom/server'",
    "import { readFileSync } from 'node:fs'",
    'const require = createRequire(import.meta.url)',
    "const cjs = require('@yishan/tiptap')",
    "assert.ok(FormEditor)",
    'assert.ok(TiptapLocaleProvider)',
    'assert.ok(cjs.FormEditor)',
    "assert.equal(createRequire(require.resolve('@yishan/tiptap'))('react'), React)",
    'for (const [Provider, useLocale] of [[TiptapLocaleProvider, useTiptapLocale], [cjs.TiptapLocaleProvider, cjs.useTiptapLocale]]) {',
    "  function Child() { return React.createElement('span', null, useLocale().toolbar) }",
    "  assert.equal(renderToString(React.createElement(Provider, { locale: { toolbar: 'fixture' } }, React.createElement(Child))), '<span>fixture</span>')",
    '}',
    "const css = require.resolve('@yishan/tiptap/index.css')",
    "assert.ok(readFileSync(css, 'utf8').length > 0)",
    "console.log('ESM/CJS/CSS and single React instance verified: ' + React.version)",
  ].join('\n'))
  run(process.execPath, ['consumer.mjs'], directory)
  await writeFile(join(directory, 'consumer.tsx'), [
    "import { FormEditor, TiptapLocaleProvider, type FormEditorProps } from '@yishan/tiptap'",
    "import '@yishan/tiptap/index.css'",
    "const props: FormEditorProps = { value: '<p>fixture</p>', onChange: (value: string) => { value.toUpperCase() } }",
    'export const editor = <TiptapLocaleProvider><FormEditor {...props} /></TiptapLocaleProvider>',
  ].join('\n'))
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2020', module: 'NodeNext', moduleResolution: 'NodeNext', jsx: 'react-jsx', strict: true, skipLibCheck: false, noEmit: true,
  }, include: ['consumer.tsx'] }, null, 2))
  // Only the compiler tool comes from the repository; types resolve from the external consumer.
  const tsc = createRequire(join(packageRoot, 'package.json')).resolve('typescript/bin/tsc')
  run(process.execPath, [tsc, '--project', 'tsconfig.json'], directory)
  const published = JSON.parse(await readFile(join(directory, 'node_modules/@yishan/tiptap/package.json'), 'utf8'))
  assert.equal(published.name, '@yishan/tiptap')
  assert.ok(!Object.values(published.dependencies ?? {}).some(value => value.startsWith('workspace:')), 'published dependencies must not require a workspace')
}
console.log('[tiptap-consumer] verified both React versions outside the repository: ' + output)
