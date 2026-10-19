const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const ts = require('typescript')

test('module declarations and runtime capabilities share a strict execution contract', () => {
  const program = ts.createProgram([path.join(__dirname, 'fixtures/capability-contract.ts')], { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }))
})
