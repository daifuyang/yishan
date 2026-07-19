const fs = require('node:fs')
const { resolveDependencyVersion } = require('./package-version.cjs')

const [sourcePackagePath, layerConfigPath, outputPackagePath] = process.argv.slice(2)

if (!sourcePackagePath || !layerConfigPath || !outputPackagePath) {
  console.error('Usage: node write-layer-package.cjs <source-package> <layer-config> <output-package>')
  process.exit(1)
}

const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, 'utf8'))
const layerConfig = JSON.parse(fs.readFileSync(layerConfigPath, 'utf8'))
const dependencies = {}

for (const name of layerConfig.dependencies || []) {
  dependencies[name] = resolveDependencyVersion(sourcePackage, sourcePackagePath, name)
}

const outputPackage = {
  name: layerConfig.name || 'runtime-layer',
  version: sourcePackage.version || '1.0.0',
  private: true,
  description: layerConfig.description,
  dependencies
}

fs.writeFileSync(outputPackagePath, `${JSON.stringify(outputPackage, null, 2)}\n`)
