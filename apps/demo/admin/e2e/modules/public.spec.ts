/**
 * 公共页 (Public) E2E。
 *
 * 公开页（不需要 auth）。目前只测登录页本身的渲染。
 */

import { test, expect } from '@playwright/test';
import { buildLocaleInitScript } from '../helpers/auth';

test.describe('模块 / 公开页', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(buildLocaleInitScript());
  });

  test('渲染 - /user/login', async ({ page }) => {
    await page.goto('/user/login');
    await expect(page.getByRole('heading', { name: '欢迎使用移山' })).toBeVisible({ timeout: 10_000 });
    // 登录按钮。antd 会在两个汉字之间插空格，所以要容忍 "登 录"。
    await expect(page.getByRole('button', { name: /^登\s*录$/ }).first()).toBeVisible();
  });
});
