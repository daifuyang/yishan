import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { businessLiterals, collectViolations, importSpecifiers, stripComments } from './check-architecture-boundaries.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'yishan-boundaries-'))
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), content)
  }
  return root
}

test('detects every rule and ignores comments, tests and near-miss words', () => {
  const root = fixture({
    'apps/yishan-api/src/modules/alpha/module.ts': "export const meta = { id: 'alpha' }\n",
    'apps/yishan-api/src/modules/alpha/a.ts': "import { b } from '../beta/b'\nexport const a = b\n",
    'apps/yishan-api/src/modules/beta/b.ts': "export const b = 'crm is fine inside a module'\n",
    'apps/yishan-api/src/core/leak.ts': "import { a } from '@/modules/alpha/a'\nexport const tag = { name: 'crm' }\n",
    'apps/yishan-api/src/core/clean.ts': "// crm mentioned only in a comment\n/* portal */\nexport const icon = 'ShoppingBag shopping'\n",
    'apps/yishan-api/src/core/tests/x.test.ts': "import '../../modules/alpha/a'\n",
    'apps/yishan-admin/src/pages/p.tsx': "const C = () => import('@/modules/alpha/pages/x')\n",
    'packages/shared/src/index.ts': "export * from '../../../apps/yishan-api/src/core/clean'\n",
  })
  try {
    const v = collectViolations(root)
    // A core import of a module path is reported both as an import and as a literal naming the module id.
    assert.deepEqual(v, [
      'business-literal|apps/yishan-admin/src/pages/p.tsx|alpha:@/modules/alpha/pages/x',
      'business-literal|apps/yishan-api/src/core/leak.ts|alpha:@/modules/alpha/a',
      'business-literal|apps/yishan-api/src/core/leak.ts|crm:crm',
      'core-imports-module|apps/yishan-admin/src/pages/p.tsx|@/modules/alpha/pages/x',
      'core-imports-module|apps/yishan-api/src/core/leak.ts|@/modules/alpha/a',
      'cross-module-import|apps/yishan-api/src/modules/alpha/a.ts|../beta/b',
      'package-imports-app|packages/shared/src/index.ts|../../../apps/yishan-api/src/core/clean',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('helpers', () => {
  assert.equal(stripComments("a // 'x'\nb /* 'y' */ 'c // kept'"), "a \nb  'c // kept'")
  assert.deepEqual(importSpecifiers("import x from 'a'\nexport * from \"b\"\nconst y = require('c')\nimport('d')\nimport 'e'"), ['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(businessLiterals("'shop' 'shopping' 'menu.portal.pages' 'crm-x'", ['shop', 'portal', 'crm']), ['shop:shop', 'portal:menu.portal.pages', 'crm:crm-x'])
})
