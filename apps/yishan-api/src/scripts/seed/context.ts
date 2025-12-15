import type { PrismaClient, SysUser } from '../../generated/prisma/client.js';

export type SeedContext = {
  prisma: PrismaClient;
  adminUser: SysUser;
};

