import { vi } from 'vitest'

vi.mock('/src/utils/prisma.js', async () => {
  const mod = await import('./mocks/prisma')
  return {
    default: mod.default,
    prismaManager: mod.prismaManager,
    prisma: mod.prisma
  }
})
