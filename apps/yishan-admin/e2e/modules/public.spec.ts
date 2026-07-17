/**
 * 公共页 (Public) E2E。
 *
 * 公开页（不需要 auth）。目前只测登录页本身的渲染。
 */

import { test, expect, type Cookie } from '@playwright/test';
import { buildLocaleInitScript } from '../helpers/auth';

test.describe('模块 / 公开页', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(buildLocaleInitScript());
  });

  test('渲染 - /user/login', async ({ page }) => {
    await page.goto('/user/login');
    await expect(page.getByText('欢迎登录系统', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    // 登录按钮
    await expect(page.getByRole('button', { name: /^登录$|^立即登录$/ }).first()).toBeVisible();
  });
});
