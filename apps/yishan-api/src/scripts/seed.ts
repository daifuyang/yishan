import 'dotenv/config';

import { prismaManager } from '../utils/prisma.js';
import { runSeed } from './seed/index.js';

const prisma = prismaManager.getClient();

async function main() {
  try {
    await runSeed(prisma as any);
  } catch (error) {
    console.error('种子数据创建失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('种子数据脚本执行完成');
  });
