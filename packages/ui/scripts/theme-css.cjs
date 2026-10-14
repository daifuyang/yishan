const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const moduleContext = { exports: {} }
const file = path.resolve(__dirname, '../mobile/theme/palette.ts')
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText
new Function('module', 'exports', source)(moduleContext, moduleContext.exports)
const css =
  '// Generated source tokens. Run pnpm --filter @yishan/ui theme:generate after editing palette.ts.\n' +
  Object.entries(moduleContext.exports.themeTokens)
    .map(
      ([theme, tokens]) =>
        `@mixin theme-${theme} {\n  color-scheme: ${theme};\n${Object.entries(tokens)
          .map(([key, value]) => `  --${key}: ${value};`)
          .join('\n')}\n}\n`,
    )
    .join('\n')
const output = path.resolve(__dirname, '../mobile/theme/colors.scss')
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== css)
    throw new Error('Theme CSS is stale; run theme:generate')
} else fs.writeFileSync(output, css)
