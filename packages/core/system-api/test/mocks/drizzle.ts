/**
 * Test mock for the database layer.
 *
 * Exports both:
 *   - `drizzleDb` (new shape: chainable query API used by `@/db` consumers)
 *   - `dbManager` (new shape: lifecycle + transaction from `@/db/manager`)
 *
 * Tests that need richer behaviour should build per-method mocks and inject
 * them via `vi.spyOn(...).mockReturnValue(...)`. The chain returned by
 * `select/insert/update/delete` defaults to resolving to `[]` (or `undefined`
 * for `returningId`) so production code that does not assert on call
 * arguments still runs end-to-end.
 */
import { vi } from 'vitest'

// Re-export the schema so tests can import real table refs for type-safe
// `where(eq(table.col, ...))` calls in their per-test mocks.
export * from '../../src/db/schema/index.js'

type AnyFn = (...args: any[]) => any
const asyncNull: AnyFn = async () => null
const asyncEmptyList: AnyFn = async () => []

function makeQueryChain(): any {
  const chain: any = {}
  const self = () => chain
  chain.from = vi.fn(self)
  chain.where = vi.fn(self)
  // Drizzle's `where` callback form returns a SQL expression directly when
  // called with a function; tests that don't care still get the chain back.
  const originalWhere = chain.where as any
  chain.where = vi.fn((arg: any) => (typeof arg === 'function' ? arg() : originalWhere()))
  chain.orderBy = vi.fn(self)
  chain.limit = vi.fn(self)
  chain.offset = vi.fn(self)
  chain.groupBy = vi.fn(self)
  chain.having = vi.fn(self)
  chain.set = vi.fn(self)
  chain.values = vi.fn(self)
  chain.returning = vi.fn(self)
  chain.$returningId = vi.fn(() => Promise.resolve([{ id: 1 }]))
  chain.onDuplicateKeyUpdate = vi.fn(self)
  chain.innerJoin = vi.fn(self)
  chain.leftJoin = vi.fn(self)
  chain.rightJoin = vi.fn(self)
  chain.fullJoin = vi.fn(self)
  chain.crossJoin = vi.fn(self)
  chain.as = vi.fn(self)
  // Allow `await chain` to resolve to [] by default; tests with richer
  // expectations can override specific terminal methods.
  chain.then = (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject)
  return chain
}

/**
 * The new Drizzle client mock. Each call to `select/insert/update/delete`
 * returns a fresh chain; each chain terminal resolves to `[]` by default.
 * Tests override specific methods (e.g. `mockReturnValueOnce`) to inject
 * richer behaviour.
 */
export const drizzleDb = {
  select: vi.fn(() => makeQueryChain()),
  insert: vi.fn(() => makeQueryChain()),
  update: vi.fn(() => makeQueryChain()),
  delete: vi.fn(() => makeQueryChain()),
  execute: vi.fn(async () => [{ '1': 1 }] as any),
  transaction: vi.fn(async (fn: any) => fn(drizzleDb)),
  query: new Proxy(
    {},
    {
      get: () => ({
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        findUniqueOrThrow: vi.fn(async () => null),
        count: vi.fn(async () => 0),
      }),
    },
  ),
}

/**
 * New `DbManager` shape (mirrors `src/db/manager.ts`). `transaction` invokes
 * the callback with `drizzleDb` so transactional code paths run in tests.
 */
export const dbManager = {
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
  healthCheck: vi.fn(async () => true),
  getConnectionStatus: vi.fn(() => ({
    connected: false,
    stats: { queryCount: 0, uptime: 0 },
  })),
  transaction: vi.fn(async (fn: any) => fn(drizzleDb)),
}

export default dbManager
