/**
 * 用户管理真实 MySQL 集成测试。
 *
 * 通过 YISHAN_RUN_INTEGRATION=1 + YISHAN_TEST_MYSQL_URL 启用；测试数据库会被
 * resetSchema() 重建，不能指向开发或生产库。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegration, type IntegrationContext } from './_setup.js';

const ctx: IntegrationContext = await setupIntegration();
const { UserRepository } = await import('../../src/core/repositories/user.repository.js');

describe.runIf(!ctx.skip)('integration: user lifecycle', () => {
  beforeAll(async () => {
    await ctx.resetSchema?.();
  });

  afterAll(async () => {
    await ctx.closeDb?.();
  });

  it('persists user fields and de-duplicates department and role links', async () => {
    const user = await UserRepository.createInTransaction({
      username: 'integration-user',
      email: 'integration-user@example.com',
      phone: '13800000001',
      passwordHash: 'test-password-hash',
      gender: 1,
      status: 1,
      creatorId: 1,
      updaterId: 1,
      deptIds: [11, 11, 12],
      roleIds: [21, 21, 22],
    });

    expect(user).toMatchObject({ username: 'integration-user', deptIds: [11, 12], roleIds: [21, 22] });
  });

  it('replaces associations, soft-deletes the user, and revokes active tokens atomically', async () => {
    const user = await UserRepository.createInTransaction({
      username: 'integration-delete-user',
      phone: '13800000002',
      passwordHash: 'test-password-hash',
      gender: 0,
      status: 1,
      creatorId: 1,
      updaterId: 1,
      deptIds: [31],
      roleIds: [41],
    });
    await UserRepository.updateInTransaction(user.id, {
      updaterId: 1,
      deptIds: [32, 32],
      roleIds: [42, 42],
    });
    const updated = await UserRepository.findById(user.id);
    expect(updated).toMatchObject({ deptIds: [32], roleIds: [42] });

    const now = new Date();
    await ctx.pool!.execute(
      `INSERT INTO sys_user_token
        (user_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, is_revoked)
       VALUES (?, ?, ?, ?, ?, false)`,
      [user.id, 'integration-access-token', 'integration-refresh-token', now, now],
    );

    await UserRepository.deleteUserInTransaction(user.id);

    await expect(UserRepository.findById(user.id)).resolves.toBeNull();
    const [tokens] = await ctx.pool!.query<any[]>(
      'SELECT is_revoked AS isRevoked, revoked_at AS revokedAt FROM sys_user_token WHERE user_id = ?',
      [user.id],
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ isRevoked: 1 });
    expect(tokens[0].revokedAt).not.toBeNull();
  });
});
