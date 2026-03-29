type AnyFn = (...args: any[]) => any

const asyncNull: AnyFn = async () => null
const asyncEmptyList: AnyFn = async () => []

const modelClient = new Proxy(
  {},
  {
    get: () => asyncNull
  }
)

const prisma = new Proxy(
  {
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $queryRaw: asyncNull,
    $executeRaw: asyncNull,
    $queryRawUnsafe: asyncNull,
    $executeRawUnsafe: asyncNull,
    $on: () => undefined,
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma as any)
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg
    }
  },
  {
    get: (target, prop: string) => {
      if (prop in target) return (target as any)[prop]
      if (prop === 'findMany') return asyncEmptyList
      return modelClient
    }
  }
)

export const prismaManager = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  getClient: () => prisma,
  healthCheck: async () => true,
  getConnectionStatus: () => ({
    connected: false,
    stats: { queryCount: 0, uptime: 0 }
  }),
  transaction: async <T>(fn: (db: any) => Promise<T>) => fn(prisma)
}

export default prismaManager
export { prisma }
