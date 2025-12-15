import type { PrismaClient } from '../../../generated/prisma/client.js';

export async function seedPosts(
  prisma: PrismaClient,
  adminUserId: number,
  posts: Array<{ name: string; sortOrder: number; description?: string }>,
) {
  for (const post of posts) {
    await prisma.sysPost.upsert({
      where: { name: post.name },
      update: {
        status: 1,
        sort_order: post.sortOrder,
        description: post.description,
        updaterId: adminUserId,
      },
      create: {
        name: post.name,
        status: 1,
        sort_order: post.sortOrder,
        description: post.description,
        creatorId: adminUserId,
        updaterId: adminUserId,
      },
    });
  }

  console.log('岗位数据创建完成');
}

