const crypto = require('node:crypto')
const fs = require('node:fs')
const { resolveDependencyVersion } = require('./package-version.cjs')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function resolveLayerState(sourcePackagePath, layerConfigPath) {
  const sourcePackage = readJson(sourcePackagePath)
  const layerConfig = readJson(layerConfigPath)
  const dependencies = {}

  for (const name of layerConfig.dependencies || []) {
    dependencies[name] = resolveDependencyVersion(sourcePackage, sourcePackagePath, name)
  }

  const state = {
    runtime: layerConfig.runtime || 'custom.debian12-node22',
    layerName: layerConfig.name || 'runtime-layer',
    dependencies
  }

  const payload = stableStringify(state)
  const fingerprint = crypto.createHash('sha256').update(payload).digest('hex')

  return {
    ...state,
    fingerprint: `sha256:${fingerprint}`
  }
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value))
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObject(value[key])
        return result
      }, {})
  }
  return value
}

function ensureLockMatches(state, lockPath) {
  if (!fs.existsSync(lockPath)) {
    throw new Error(`Layer lock not found: ${lockPath}`)
  }

  const lock = readJson(lockPath)
  if (!lock.arn) {
    throw new Error(`Layer lock does not contain an arn: ${lockPath}`)
  }
  if (lock.fingerprint !== state.fingerprint) {
    throw new Error(
      [
        'Layer lock fingerprint mismatch.',
        `Expected: ${state.fingerprint}`,
        `Actual:   ${lock.fingerprint || '(missing)'}`,
        'Publish a new runtime layer and update layer-lock.json.'
      ].join('\n')
    )
  }

  return lock
}

function printUsage() {
  console.error(`Usage:
  node layer-state.cjs fingerprint <package.json> <layer-dependencies.json>
  node layer-state.cjs arn <package.json> <layer-dependencies.json> <layer-lock.json>
  node layer-state.cjs record <package.json> <layer-dependencies.json> <layer-lock.json> <layer-arn>`)
}

const [command, sourcePackagePath, layerConfigPath, lockPath, arn] = process.argv.slice(2)

try {
  if (!command || !sourcePackagePath || !layerConfigPath) {
    printUsage()
    process.exit(1)
  }

  const state = resolveLayerState(sourcePackagePath, layerConfigPath)

  if (command === 'fingerprint') {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`)
  } else if (command === 'arn') {
    if (!lockPath) {
      printUsage()
      process.exit(1)
    }
    const lock = ensureLockMatches(state, lockPath)
    process.stdout.write(`${lock.arn}\n`)
  } else if (command === 'record') {
    if (!lockPath || !arn) {
      printUsage()
      process.exit(1)
    }
    const lock = {
      ...state,
      arn,
      updatedAt: new Date().toISOString()
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    process.stdout.write(`${lock.fingerprint}\n`)
  } else {
    printUsage()
    process.exit(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
