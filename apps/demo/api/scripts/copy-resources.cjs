const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

function copyResources(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) copyResources(file)
    else if (/\.(json|sql)$/.test(file)) {
      const destination = path.join(root, 'dist', path.relative(path.join(root, 'src'), file))
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(file, destination)
    }
  }
}

copyResources(path.join(root, 'src'))
