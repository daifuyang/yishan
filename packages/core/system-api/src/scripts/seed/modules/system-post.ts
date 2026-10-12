import { sysPost } from '@/db/schema';
import type { SeedDb } from '../context.js';

export async function seedPosts(
  db: SeedDb,
  adminUserId: number,
  posts: Array<{ name: string; sortOrder: number; description?: string }>,
) {
  for (const post of posts) {
    const createData = {
      name: post.name,
      status: 1,
      sortOrder: post.sortOrder,
      ...(post.description !== undefined ? { description: post.description } : {}),
      creatorId: adminUserId,
      updaterId: adminUserId,
    };
    await db.insert(sysPost).values(createData).onDuplicateKeyUpdate({ set: { name: post.name } });
  }

  console.log('岗位数据创建完成');
}
