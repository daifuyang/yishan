const path = require('node:path')

const pageNames = [
  'user', 'role', 'department', 'position', 'menu', 'dict', 'region',
  'site', 'storage', 'attachments', 'login-log', 'module-management',
]

exports.systemPages = Object.fromEntries(
  pageNames.map((name) => [`./system/${name}`, `@yishan/core-system-admin/pages/${name}`]),
)
exports.generatedServicesDirectory = path.resolve(__dirname, '../src/services')
exports.namespace = 'SystemAPI'
