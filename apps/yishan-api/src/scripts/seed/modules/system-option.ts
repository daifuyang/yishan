import { sysOption } from '@/db/schema';
import type { SeedDb } from '../context.js';

export async function upsertSysOption(
  db: SeedDb,
  adminUserId: number,
  key: string,
  value: string,
) {
  await db
    .insert(sysOption)
    .values({ key, value, status: 1, creatorId: adminUserId, updaterId: adminUserId })
    .onDuplicateKeyUpdate({ set: { value, updaterId: adminUserId } });
}

export async function seedSysOptions(
  db: SeedDb,
  adminUserId: number,
  options: Array<{ key: string; value: string }>,
) {
  for (const item of options) {
    await upsertSysOption(db, adminUserId, item.key, item.value);
  }
  console.log('系统参数初始化完成');
}
