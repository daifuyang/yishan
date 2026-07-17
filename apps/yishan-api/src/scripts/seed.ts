import 'dotenv/config';

import { pool } from '@/db';
import { runSeed } from './seed/index.js';

async function main() {
  try {
    await runSeed();
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
    await pool.end();
    console.log('种子数据脚本执行完成');
  });
