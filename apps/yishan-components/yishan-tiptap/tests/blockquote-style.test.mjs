import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const stylesheet = readFileSync(
  new URL('../src/components/tiptap-node/blockquote-node/blockquote-node.scss', import.meta.url),
  'utf8',
)

assert.match(stylesheet, /background-color:\s*var\(--tt-gray-light-50\)/)
assert.match(stylesheet, /border-left:\s*4px solid var\(--tt-gray-light-300\)/)
assert.match(stylesheet, /border-radius:\s*var\(--ant-border-radius\)/)
assert.match(stylesheet, /blockquote\s*\{[\s\S]*?display:\s*block/)

console.log('blockquote block style contract passes')
