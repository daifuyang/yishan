import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:3100').replace(/\/+$/, '')
const output = resolve(apiRoot, process.argv[3] ?? 'openapi.json')
const response = await fetch(`${baseUrl}/api/docs/json`, { signal: AbortSignal.timeout(10000) })
if (!response.ok) throw new Error(`OpenAPI endpoint returned HTTP ${response.status}`)
const spec = await response.json()
if (!spec.openapi || !spec.paths || typeof spec.paths !== 'object') throw new Error('Response is not an OpenAPI document')
writeFileSync(output, JSON.stringify(spec), 'utf8')
console.log(`[openapi-dump] ${Object.keys(spec.paths).length} paths -> ${output}`)
