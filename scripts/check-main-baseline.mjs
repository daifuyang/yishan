#!/usr/bin/env node
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from './module-manifest.cjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const products = manifest.findProductApis(repositoryRoot)
if (!products.length) throw new Error('No product API manifests found')
for (const apiRoot of products) {
  const ids = new Set()
  for (const module of manifest.readInstalledModules(apiRoot)) {
    if (!/^[a-z0-9_]{1,24}$/.test(module.id)) throw new Error(`Invalid installed module id: ${module.id}`)
    if (ids.has(module.id)) throw new Error(`Duplicate installed module id: ${module.id}`)
    if (module.local && basename(dirname(module.entry)) !== module.id) throw new Error(`Module id ${module.id} does not match its source directory`)
    ids.add(module.id)
  }
  console.log(`[product-manifest] ${apiRoot}: ${[...ids].join(', ')}`)
}
