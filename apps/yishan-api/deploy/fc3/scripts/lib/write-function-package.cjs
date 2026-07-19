const fs = require('node:fs')
const { resolveDependencyVersion } = require('./package-version.cjs')

const [sourcePackagePath, layerConfigPath, outputPackagePath] = process.argv.slice(2)

if (!sourcePackagePath || !layerConfigPath || !outputPackagePath) {
  console.error('Usage: node write-function-package.cjs <source-package> <layer-config> <output-package>')
  process.exit(1)
}

const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, 'utf8'))
const layerConfig = JSON.parse(fs.readFileSync(layerConfigPath, 'utf8'))
const dependencies = {}

for (const name of layerConfig.localDependencies || []) {
  dependencies[name] = resolveDependencyVersion(sourcePackage, sourcePackagePath, name)
}

const outputPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  private: true,
  type: sourcePackage.type,
  main: sourcePackage.main,
  dependencies
}

fs.writeFileSync(outputPackagePath, `${JSON.stringify(outputPackage, null, 2)}\n`)
