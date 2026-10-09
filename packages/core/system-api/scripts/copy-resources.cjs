const { cpSync, readdirSync, mkdirSync } = require('node:fs')
const { join, dirname } = require('node:path')
function copyJson(directory, destination) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = join(directory,entry.name), target = join(destination,entry.name)
    if (entry.isDirectory()) copyJson(source,target)
    else if (entry.name.endsWith('.json')) { mkdirSync(dirname(target),{recursive:true}); cpSync(source,target) }
  }
}
copyJson(join(__dirname,'../src'),join(__dirname,'../dist'))
cpSync(join(__dirname,'../drizzle'),join(__dirname,'../dist/drizzle'),{recursive:true})
