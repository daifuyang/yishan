/**
 * 账户 (Account) 模块 E2E。
 *
 * 2 个页面：
 *   - /account/api-tokens — API Token 管理（完整的 create + revoke 流程）
 *   - /account/center     — 个人中心
 *
 * API Token 的端到端 CRUD 测试是这里的核心，跟之前的 api-token.spec.ts 等价
 * （已合并到这里）。
 */

import { test, expect, type Page, type Response, type Cookie } from '@playwright/test';
import { loadAuthCookies, buildLocaleInitScript } from '../helpers/auth';

interface PageSpec {
  path: string;
  label: string;
  expectText: string;
}

const PAGES: PageSpec[] = [
  { path: '/account/center', label: '个人中心', expectText: '个人中心' },
  // api-tokens 的 render 检查在下面的 describe-with-flow 里覆盖。
];

// Module-scope so afterAll (which doesn't see describe-scope let-bindings)
// can use it for cleanup of leftover e2e tokens.
let moduleCookies: Cookie[] = [];
const TOKEN_NAME_PREFIX = 'playwright-e2e-';

function trackApiFailures(page: Page): { failures: string[]; dispose: () => void } {
  const failures: string[] = [];
  const handler = (resp: Response) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    if (resp.status() === 401 || resp.status() === 403) return;
    if (resp.status() >= 400) failures.push(`${resp.status()} ${resp.request().method()} ${url}`);
  };
  page.on('response', handler);
  return { failures, dispose: () => page.off('response', handler) };
}

test.describe('模块 / 账户 - 页面渲染', () => {
  let cookies: Cookie[] = [];

  test.beforeAll(async () => {
    cookies = await loadAuthCookies();
    moduleCookies = cookies; // share with afterAll
    expect(cookies.length).toBeGreaterThan(0);
  });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(buildLocaleInitScript());
  });

  for (const spec of PAGES) {
    test(`渲染 - ${spec.path}`, async ({ context, page }) => {
      await context.addCookies(cookies);
      const tracker = trackApiFailures(page);
      await page.goto(spec.path);

      expect(page.url()).not.toContain('/user/login');
      await expect(page.getByText(spec.expectText, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.ant-result-404')).toHaveCount(0);

      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      expect(tracker.failures, tracker.failures.length > 0 ? `API 失败:\n  ${tracker.failures.join('\n  ')}` : '').toHaveLength(0);
      tracker.dispose();
    });
  }
});

// ============================================================================
// API Token - 端到端 CRUD 流程
// ============================================================================

test.describe('模块 / 账户 - API Token CRUD', () => {
  let cookies: Cookie[] = [];

  test.beforeAll(async () => {
    cookies = await loadAuthCookies();
    moduleCookies = cookies;
    expect(cookies.length).toBeGreaterThan(0);
  });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(buildLocaleInitScript());
  });

  test('3. 创建 + 撤销完整流程', async ({ context, page }) => {
    await context.addCookies(cookies);
    const tokenName = `${TOKEN_NAME_PREFIX}${Date.now()}`;

    await page.goto('/account/api-tokens');
    await expect(page.getByText('API Token 管理', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 1. 点击 新建 Token
    await page.getByRole('button', { name: /新建 Token/ }).click();

    // 2. 等 scopes 加载完 + 模态打开
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/me/api-tokens/available-scopes') &&
          r.status() < 400,
        { timeout: 10_000 },
      ),
      page.locator('.ant-modal').filter({ hasText: '新建 API Token' }).waitFor({ state: 'visible', timeout: 5_000 }),
    ]);

    // 3. 填 name
    const modal = page.locator('.ant-modal').filter({ hasText: '新建 API Token' });
    await modal.locator('input').first().fill(tokenName);

    // 4. 等 OK 按钮 enabled（避免 scopes 加载竞态）
    const createBtn = modal.locator('.ant-modal-footer button.ant-btn-primary').first();
    await expect(createBtn, 'OK 按钮必须 enabled').toBeEnabled({ timeout: 5_000 });

    // 5. 提交（app 在空 scopes 时弹"确认创建无权限 Token"二次确认）
    const createBtnPromise = createBtn.click();
    const [emptyScopes, createResp] = await Promise.all([
      page.locator('.ant-modal').filter({ hasText: '确认创建无权限 Token' })
        .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
      page.waitForResponse(
        (r) => Boolean(r.url().match(/\/api\/v1\/me\/api-tokens(\?|$)/)) && r.request().method() === 'POST',
        { timeout: 10_000 },
      ).catch(() => null),
    ]);
    await createBtnPromise;

    if (emptyScopes && !createResp) {
      const confirmModal = page.locator('.ant-modal').filter({ hasText: '确认创建无权限 Token' });
      await confirmModal.getByRole('button', { name: /^(确认创建|Confirm Create|创建)/ }).first().click();
      const real = await page.waitForResponse(
        (r) => Boolean(r.url().match(/\/api\/v1\/me\/api-tokens(\?|$)/)) && r.request().method() === 'POST',
        { timeout: 10_000 },
      );
      expect(real.status(), 'POST 应该成功').toBeLessThan(400);
    } else if (createResp) {
      expect(createResp.status()).toBeLessThan(400);
    } else {
      throw new Error('No POST and no confirm modal — form submit failed silently');
    }

    // 6. 披露 modal — 拿到 plaintext（Antd Space.Compact 让 button 文本是 "确 认"）
    const createdModal = page.locator('.ant-modal').filter({ hasText: '请保存你的 API Token' });
    await createdModal.first().waitFor({ state: 'visible', timeout: 10_000 });
    const tokenInput = createdModal.locator('input[readonly]').first();
    await expect(tokenInput).toBeVisible({ timeout: 5_000 });
    const plaintext = await tokenInput.inputValue();
    expect(plaintext.length, '明文 token 应有内容').toBeGreaterThan(10);

    // 等空 scopes 二次确认 modal 完全关闭
    const emptyScopesDom = page.locator('.ant-modal').filter({ hasText: '确认创建无权限 Token' });
    if ((await emptyScopesDom.count()) > 0) {
      await emptyScopesDom.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }

    // 关闭披露 modal（button 文字 "确 认"，因 Space.Compact 在 btn 之间插了空格）
    await createdModal.getByRole('button', { name: /确\s*认/ }).first().click();
    await createdModal.first().waitFor({ state: 'hidden', timeout: 5_000 });

    // 7. 行应在表格中
    const row = page.locator('tr', { hasText: tokenName });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // 8. 撤销（Popconfirm）
    await row.getByRole('button', { name: /^撤销$/ }).click();
    const popconfirm = page.locator('.ant-popconfirm').filter({ hasText: '确认撤销?' });
    await popconfirm.locator('.ant-popconfirm-buttons button.ant-btn-primary, .ant-popconfirm-buttons button.ant-btn-dangerous').first().click();
    await expect(row).toHaveCount(0, { timeout: 10_000 });
  });
});

// ============================================================================
// afterAll 清理 — 撤销任何 e2e 产生的遗留 token
// ============================================================================

test.afterAll(async () => {
  const accessToken = moduleCookies.find((c) => c.name === 'yishan_at')?.value;
  if (!accessToken) return;
  try {
    const listResp = await fetch('http://localhost:3000/api/v1/me/api-tokens', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listResp.ok) return;
    const listBody = (await listResp.json()) as {
      success?: boolean;
      data?: { list?: Array<{ id: number; name: string }> };
    };
    const leftover = (listBody.data?.list ?? []).filter((t) =>
      t.name.startsWith(TOKEN_NAME_PREFIX),
    );
    for (const t of leftover) {
      await fetch(`http://localhost:3000/api/v1/me/api-tokens/${t.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
    }
  } catch {
    // best-effort
  }
});
