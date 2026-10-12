const { join, resolve, dirname } = require('node:path')
const { mkdirSync, writeFileSync } = require('node:fs')
const { generateModuleComponents } = require('./registry.cjs')

function createAdminPlugin({ apiRoot, systemPages = {}, watchPaths = [] }) {
  return (api) => {
    api.describe({ key: 'admin-module-components' })
    const adminRoot = api.cwd
    const pairedApi = resolve(adminRoot, apiRoot)
    api.onGenerateFiles(() => {
      const target = join(api.paths.absTmpPath, 'module-components.ts')
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, generateModuleComponents({ adminRoot, apiRoot: pairedApi, systemPages }))
    })
    api.addTmpGenerateWatcherPaths(() => [
      join(adminRoot, 'src/pages'), join(adminRoot, 'src/modules'),
      join(pairedApi, 'src/manifest.ts'), join(pairedApi, 'src/modules'), ...watchPaths,
    ])
  }
}
module.exports = { createAdminPlugin }
