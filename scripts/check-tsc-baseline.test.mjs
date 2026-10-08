import assert from 'node:assert/strict'
import test from 'node:test'
import { multisetMinus, parseTscOutput } from './check-tsc-baseline.mjs'

test('parses tsc diagnostics without line numbers and normalises paths', () => {
  const out = [
    "src\\a.ts(10,5): error TS2322: Type 'x' is not assignable to type 'y'.",
    "  Property 'z' does not exist.",
    'src/b.ts(1,1): error TS7030: Not all code paths return a value.',
    'Found 2 errors.',
  ].join('\n')
  assert.deepEqual(parseTscOutput(out), [
    "src/a.ts|TS2322|Type 'x' is not assignable to type 'y'.",
    'src/b.ts|TS7030|Not all code paths return a value.',
  ])
})

test('diagnostics without a file location are parsed too', () => {
  assert.deepEqual(parseTscOutput("error TS5023: Unknown compiler option 'foo'.\nsrc/a.ts(1,1): error TS7030: x"), [
    "<global>|TS5023|Unknown compiler option 'foo'.",
    'src/a.ts|TS7030|x',
  ])
})

test('multiset difference keeps duplicates so a repeated new error is still detected', () => {
  assert.deepEqual(multisetMinus(['a', 'a', 'b'], ['a', 'b']), ['a'])
  assert.deepEqual(multisetMinus(['a'], ['a', 'a']), [])
  assert.deepEqual(multisetMinus(['a', 'a'], ['a']), ['a'])
})
