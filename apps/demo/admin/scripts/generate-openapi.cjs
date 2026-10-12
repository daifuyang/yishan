const { join, resolve } = require('node:path')
const { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } = require('node:fs')
const { generateService } = require('@umijs/openapi')
const { selectOpenApi } = require('@yishan/core-admin/openapi')
const { readInstalledModules } = require('@yishan/core-admin/manifest')
const { generatedServicesDirectory, namespace } = require('@yishan/core-system-admin/umi')

const adminRoot = resolve(__dirname, '..')
const apiRoot = resolve(adminRoot, '../api')
const schema = JSON.parse(readFileSync(join(apiRoot, 'openapi.json'), 'utf8'))
const installed = readInstalledModules(apiRoot).map(module => module.id)
const cache = join(adminRoot, 'node_modules/.cache/admin-openapi')
mkdirSync(cache, { recursive: true })

async function generate(name, serversPath, apiNamespace, includePath) {
  const schemaPath = join(cache, `${name}.json`)
  writeFileSync(schemaPath, JSON.stringify(selectOpenApi(schema, includePath)))
  const output = join(serversPath, 'generated')
  mkdirSync(output, { recursive: true })
  // The generator does not remove obsolete controllers. Only remove its owned flat output files.
  for (const file of readdirSync(output)) if (/\.(ts|json)$/.test(file)) unlinkSync(join(output, file))
  await generateService({ schemaPath, serversPath, projectName: 'generated', namespace: apiNamespace, requestLibPath: "import { request } from '@umijs/max'", mock: false })
}

async function main() {
  await generate('system', generatedServicesDirectory, namespace, path => path.startsWith('/api/v1/'))
  await generate('product', join(adminRoot, 'src/services'), 'API', path => installed.some(id => path.startsWith(`/api/${id}/`)))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
