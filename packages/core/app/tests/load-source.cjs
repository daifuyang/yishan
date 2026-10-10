const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')

function loadSource(entry, mocks = {}) {
  const cache = new Map()
  const root = path.resolve(__dirname, '..')
  function load(file) {
    const absolute = path.resolve(root, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const module = { exports: {} }
    cache.set(absolute, module)
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    function resolveImport(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (!id.startsWith('.')) return createRequire(absolute)(id)
      const base = path.resolve(path.dirname(absolute), id)
      const target = [base, `${base}.ts`, path.join(base, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!target) throw new Error(`Cannot resolve ${id}`)
      return load(target)
    }
    const factory = vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: absolute })
    factory(resolveImport, module, module.exports)
    return module.exports
  }
  return load(entry)
}

module.exports = { loadSource }
