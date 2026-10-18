/**
 * 登录日志用户隔离真实 MySQL 集成测试。
 *
 * 单元测试 mock 掉了 repository，只能证明 service 的错误映射；这里用真实 SQL
 * 证明 findByIdForUser 的 where 条件确实带上了 userId，管理员读取需显式范围。
 * test:integration 创建随机本地 schema，迁移后在显式
 * SystemRuntime 内执行。
 */
import { afterAll, describe, expect } from 'vitest';
import { setupIntegration, it, type IntegrationContext } from './_setup.js';
import { runWithDataScope } from '../../src/core/auth/data-scope.js';

const asAdmin = <T>(fn: () => T): T => runWithDataScope({ userId: 1, roleIds: [], deptIds: [], superAdmin: true }, fn);

const ctx: IntegrationContext = await setupIntegration();
const { LoginLogRepository } = await import('../../src/core/repositories/login-log.repository.js');

describe.runIf(!ctx.skip)('integration: login log user scoping', () => {
  afterAll(async () => {
    await ctx.closeDb?.();
  });

  it('returns the owner row, hides it from another user, and keeps the admin lookup unconstrained', async () => {
    const owner = await LoginLogRepository.create({
      userId: 7001,
      username: 'integration-login-owner',
      status: 1,
      message: '登录成功',
    });
    const other = await LoginLogRepository.create({
      userId: 7002,
      username: 'integration-login-other',
      status: 1,
      message: '登录成功',
    });

    // The owner sees their own row.
    await expect(LoginLogRepository.findByIdForUser(owner.id, 7001)).resolves.toMatchObject({
      id: owner.id,
      userId: 7001,
      username: 'integration-login-owner',
    });

    // A different user gets null for the very same row, despite having their
    // own login record — this is the whole point of the endpoint.
    await expect(LoginLogRepository.findByIdForUser(owner.id, 7002)).resolves.toBeNull();

    // The second user still resolves their own row (null is not a broad bug).
    await expect(LoginLogRepository.findByIdForUser(other.id, 7002)).resolves.toMatchObject({
      id: other.id,
      userId: 7002,
    });

    await expect(LoginLogRepository.findById(owner.id)).resolves.toBeNull();
    await expect(asAdmin(() => LoginLogRepository.findById(owner.id))).resolves.toMatchObject({
      id: owner.id,
      userId: 7001,
    });
  });

  it('never exposes a null-userId row (failed login for an unknown account) to any user', async () => {
    const anonymous = await LoginLogRepository.create({
      userId: null,
      username: 'integration-unknown-account',
      status: 0,
      message: '用户不存在',
    });

    await expect(LoginLogRepository.findByIdForUser(anonymous.id, 7001)).resolves.toBeNull();
    await expect(LoginLogRepository.findByIdForUser(anonymous.id, 7002)).resolves.toBeNull();
    await expect(asAdmin(() => LoginLogRepository.findById(anonymous.id))).resolves.toMatchObject({
      id: anonymous.id,
      userId: null,
    });
  });
});
