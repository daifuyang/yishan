import type { PrismaClient } from '../../../generated/prisma/client.js';

export async function upsertSysOption(
  prisma: PrismaClient,
  adminUserId: number,
  key: string,
  value: string,
) {
  const existed = await prisma.sysOption.findFirst({ where: { key } });
  if (existed) {
    await prisma.sysOption.update({ where: { id: existed.id }, data: { value, updaterId: adminUserId } });
  } else {
    await prisma.sysOption.create({
      data: { key, value, status: 1, creatorId: adminUserId, updaterId: adminUserId },
    });
  }
}

export async function seedSysOptions(
  prisma: PrismaClient,
  adminUserId: number,
  options: Array<{ key: string; value: string }>,
) {
  for (const item of options) {
    await upsertSysOption(prisma, adminUserId, item.key, item.value);
  }
  console.log('系统参数初始化完成');
}
