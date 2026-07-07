const fs = require('node:fs')
const path = require('node:path')

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return undefined
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function packageLockPathFor(packageJsonPath) {
  return path.join(path.dirname(packageJsonPath), 'package-lock.json')
}

function packageLockKey(name) {
  return `node_modules/${name}`
}

function resolveDependencyVersion(sourcePackage, sourcePackagePath, name) {
  const packageLock = readJsonIfExists(packageLockPathFor(sourcePackagePath))
  const locked = packageLock?.packages?.[packageLockKey(name)]
  if (locked?.version) {
    return locked.version
  }

  const sourceDependencies = sourcePackage.dependencies || {}
  if (!sourceDependencies[name]) {
    throw new Error(`Dependency "${name}" is missing from package.json dependencies`)
  }
  return sourceDependencies[name]
}

module.exports = {
  resolveDependencyVersion
}
