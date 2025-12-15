import type { PrismaClient } from '../../generated/prisma/client.js';

import {
  deptTreeSeed,
  dictsSeed,
  portalArticlesSeed,
  portalCategoriesSeed,
  portalMenusSeed,
  portalPagesSeed,
  portalTemplatesSeed,
  postsSeed,
  systemMenusSeed,
} from './config.js';
import { ensureAdminUser } from './modules/system-user.js';
import { bindUserRole, ensureSystemRoles } from './modules/system-role.js';
import { seedDepartments } from './modules/system-dept.js';
import { seedPosts } from './modules/system-post.js';
import { seedMenus } from './modules/system-menu.js';
import { seedDicts } from './modules/system-dict.js';
import { seedPortalCategories, seedPortalArticles, seedPortalPages } from './modules/portal-content.js';
import { seedPortalTemplates } from './modules/portal-template.js';

export async function runSeed(prisma: PrismaClient) {
  console.log('开始执行种子数据脚本...');

  const adminUser = await ensureAdminUser(prisma);
  const { superAdminRole } = await ensureSystemRoles(prisma, adminUser.id);
  await bindUserRole(prisma, adminUser.id, superAdminRole.id);

  await seedDepartments(prisma, adminUser.id, deptTreeSeed);
  await seedPosts(prisma, adminUser.id, postsSeed);
  await seedMenus(prisma, adminUser.id, [systemMenusSeed, portalMenusSeed]);
  await seedDicts(prisma, adminUser.id, dictsSeed);

  const categorySlugToId = await seedPortalCategories(prisma, adminUser.id, portalCategoriesSeed);
  await seedPortalPages(prisma, adminUser.id, portalPagesSeed);
  await seedPortalTemplates(prisma, adminUser.id, portalTemplatesSeed);
  await seedPortalArticles(prisma, adminUser.id, portalArticlesSeed, categorySlugToId);

  console.log('种子数据创建完成');
}

