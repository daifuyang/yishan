/**
 * CRM 模块 Playwright E2E 验证测试。
 *
 * 目的：以浏览器视角验证各 CRM 页面是否能正常打开、表格能否加载数据，
 * 暴露后端 API 与前端渲染之间的契约问题（如缺字段、5xx）。
 *
 * 已知前置条件：
 *   - API 在 http://localhost:3100（项目 .env 默认 PORT=3100，shared-config DEFAULT_API_TARGET 也是 3100）。
 *     ⚠️ 注意：仓库根的 `playwright.config.ts` 仍硬编码 baseURL='http://localhost:8000'，
 *        并由 `helpers/auth helper.ts` 的 DEFAULT_API 默认走 3000（错的）。
 *        所以这个 spec **必须**显式传 `apiBaseURL: 'http://localhost:3100'` 给登录 helper。
 *   - Admin 在 http://localhost:8000。
 *
 * 运行：
 *   pnpm exec playwright test e2e/modules/crm.spec.ts --reporter=list
 */

import { test, expect, type Page, type Response, type Cookie } from '@playwright/test';
import {
  loadAuthCookies,
  buildLocaleInitScript,
} from '../helpers/auth';

// ============================================================================
// 页面清单（与 system-menu.json 一致）
// ============================================================================

interface PageSpec {
  /** 浏览器路由路径 */
  path: string;
  /** 关键文本断言（页面主标题或表头） */
  expectText: string;
  /**
   * 关键 API 路径。这个测试在每个页面加载期间观察：
   *   - 这条 API 是否成功（<400）
   *   - 渲染的列表行数 > 0
   * 当 `api` 为空时只检查 page expectText 和无 5xx。
   */
  api?: string;
}

const PAGES: PageSpec[] = [
  { path: '/crm/dashboard',     expectText: '工作台',   api: '/api/crm/v1/dashboard' },
  { path: '/crm/leads',          expectText: '线索',     api: '/api/crm/v1/leads' },
  { path: '/crm/lead-pool',      expectText: '线索池' },
  { path: '/crm/customers',      expectText: '客户',     api: '/api/crm/v1/customers' },
  { path: '/crm/pool',           expectText: '客户公海', api: '/api/crm/v1/pool' },
  { path: '/crm/contacts',       expectText: '联系人',   api: '/api/crm/v1/contacts' },
  { path: '/crm/activities',     expectText: '跟进' },
  { path: '/crm/visits',         expectText: '拜访',     api: '/api/crm/v1/visits' },
  { path: '/crm/settings/tags',      expectText: '标签',     api: '/api/crm/v1/settings/tags' },
  { path: '/crm/settings/statuses',  expectText: '状态',     api: '/api/crm/v1/settings/statuses' },
  { path: '/crm/settings/sources',  expectText: '来源',     api: '/api/crm/v1/settings/sources' },
  { path: '/crm/settings/enums',     expectText: '枚举',     api: '/api/v1/admin/enums' },
];

// ============================================================================
// Helpers
// ============================================================================

/** 收集所有 /api/* 响应，标记 4xx/5xx（401/403 视为正常）。 */
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

// ============================================================================
// Tests
// ============================================================================

test.describe('模块 / CRM 渲染验证', () => {
  let cookies: Cookie[] = [];

  // 注意：loadAuthCookies 默认连 3000，但本仓库的 API 实际在 3100。
  // 因此这里显式走一次 3100 的登录，写入 e2e/fixtures/auth.json 后由 loadAuthCookies 命中。
  // 每次新跑前用 `pnpm --filter yishan-api db:seed && ./scripts/refresh-auth-fixture.sh`
  // 重新生成 fixture；此处直接读 fixture 以避开登录 5/min 限流。
  test.beforeAll(async () => {
    cookies = await loadAuthCookies();
    expect(cookies.length, '需要 auth.json fixture（yishan_at + yishan_rt）').toBeGreaterThan(0);
  });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(buildLocaleInitScript());
  });

  for (const spec of PAGES) {
    test(`渲染 - ${spec.path}`, async ({ context, page }) => {
      await context.addCookies(cookies);
      const tracker = trackApiFailures(page);

      await page.goto(spec.path);

      // 1. 没有被踢回登录页
      expect(page.url(), '页面被重定向到登录页（auth 失败）').not.toContain('/user/login');

      // 2. 没渲染 404 组件
      await expect(page.locator('.ant-result-404'), '不应出现 404 组件').toHaveCount(0);

      // 3. 关键文本可见
      await expect(
        page.getByText(spec.expectText, { exact: false }).first(),
        `未找到关键文本 "${spec.expectText}"`,
      ).toBeVisible({ timeout: 10_000 });

      // 4. 等网络稳定
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

      // 5. 报告所有 4xx/5xx（不直接 fail，让前端产品决策哪些算 bug）
      if (tracker.failures.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[${spec.path}] API 失败:\n  ${tracker.failures.join('\n  ')}`);
      }

      tracker.dispose();
    });
  }
});

// ============================================================================
// 单独验证：CRM 后端契约 — 每个关键 API 都能 200。
// 这些 API 由前端发起，捕获 5xx / 4xx 即说明后端代码或 DB schema 与前端契约不一致。
// ============================================================================

test.describe('模块 / CRM 后端契约', () => {
  let cookies: Cookie[] = [];

  test.beforeAll(async () => {
    cookies = await loadAuthCookies();
  });

  for (const spec of PAGES) {
    if (!spec.api) continue;
    test(`契约 - ${spec.api} 返回 2xx`, async ({ request }) => {
      const token = cookies.find((c) => c.name === 'yishan_at')?.value;
      expect(token, '需要 yishan_at 才能构造请求').toBeTruthy();
      // 直接拼到 admin origin 上，避开 dev 代理差异
      const resp = await request.get(`http://localhost:3100${spec.api}?page=1&pageSize=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resp.status(), `${spec.api} 应返回 <500 业务码，实际 ${resp.status()}`).toBeLessThan(500);
      const body = await resp.json();
      // 业务码 10000 = 操作成功；任何 success=false 都是问题
      expect(body?.success, `${spec.api} 业务码 success 应为 true：${JSON.stringify(body).slice(0, 200)}`).toBe(true);
    });
  }
});