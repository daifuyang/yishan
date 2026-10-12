import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageApi } from '../../../../scripts/package-api.mjs'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
packageApi({ apiRoot, output: process.argv[2] })
