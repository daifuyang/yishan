const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const appRoot = path.resolve(__dirname, '../..')

// Exercise the production TypeScript against the platform boundary, without a browser or WeChat runtime.
function loadTs(entry, mocks = {}) {
  const cache = new Map()
  function load(file) {
    const absolute = path.resolve(appRoot, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const module = { exports: {} }
    cache.set(absolute, module)
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      fileName: absolute,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText
    function localRequire(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (!id.startsWith('.') && !id.startsWith('@/')) return require(id)
      const base = id.startsWith('@/')
        ? path.resolve(appRoot, 'src', id.slice(2))
        : path.resolve(path.dirname(absolute), id)
      const resolved = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!resolved) throw new Error(`Cannot resolve ${id} from ${file}`)
      return load(resolved)
    }
    const factory = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, {
      filename: absolute,
    })
    factory(localRequire, module, module.exports, absolute, path.dirname(absolute))
    return module.exports
  }
  return load(entry)
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

module.exports = { loadTs, deferred, appRoot }
