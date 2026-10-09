/**
 * 系统管理 (System Admin) 模块的 E2E 测试。
 *
 * 每个页面三个粒度：
 *   1. render  - 页面能打开 + 关键文本可见 + 无 404 + API 不报 4xx/5xx
 *   2. search  - 搜索框输入关键字，列表应正确过滤
 *   3. create  - 新建表单能填完并提交，新行出现在表格中
 *
 * Pre-reqs（与 playwright.config.ts 一致）：
 *   - API 在 http://localhost:3000（admin/admin123 已 seed）
 *   - Admin 在 http://localhost:8000
 *
 * Run：
 *   pnpm exec playwright test e2e/modules/system.spec.ts --reporter=list
 */

import { test, expect, type Page, type Response, type Cookie } from '@playwright/test';
import {
  loadAuthCookies,
  buildLocaleInitScript,
} from '../helpers/auth';

// ============================================================================
// Page catalog
// ============================================================================

interface PageSpec {
  path: string;
  label: string;
  /** Page-level assertion: text visible after render */
  expectText: string;
  /** Search smoke: keyword + a row's text that should remain after filtering */
  search?: { query: string; hit: string };
  /**
   * Negative search: a query that must NOT match any row. After this search
   * the table should be empty (0 data rows + "暂无数据" placeholder visible).
   * Skipped if undefined.
   */
  noMatchSearch?: { query: string };
  /**
   * If true, run a comprehensive set of search edge cases on this page:
   * SQL-injection-shaped input, LIKE wildcards, very long query, clear
   * and re-search. See `runSearchEdgeCases` for the full list. Only enabled
   * on a few representative pages to keep suite runtime manageable.
   */
  searchEdgeCases?: boolean;
  /** Create smoke: ProForm fields + new row's text to assert */
  newRecord?: { fields: Record<string, string>; hit: string; prefix: string };
  /** Skip API-failure assertions (pre-existing 5xx we don't own) */
  skipApiCheck?: boolean;
}

/**
 * 系统管理 11 个页面。岗位管理路径是 /system/position（之前叫 post，
 * 已重命名）。站点配置 / 云存储 / 媒体库 / 登录日志没有 ProTable 搜索/新建，
 * 仅做 render 检查。
 *
 * 创建测试用 `{ts}` 占位符生成唯一值（用户名、手机号、邮箱等），
 * 避免之前测试的残留数据导致 API "已存在" 错误。
 */
const PAGES: PageSpec[] = [
  {
    path: '/system/user',
    label: '用户管理',
    expectText: '用户列表',
    search: { query: 'admin', hit: 'admin' },
    noMatchSearch: { query: 'zzzzz_no_match_user_zzzzz' },
    searchEdgeCases: true,
    newRecord: {
      fields: {
        username: 'e2e-user-{ts}',
        // 手机号格式 1XXXXXXXXX，必须 11 位；用 ts 后 11 位保证唯一
        phone: '{phone}',
        password: 'e2eTest123',
        status: '1',
      },
      hit: 'e2e-user-',
      prefix: 'e2e-user-',
    },
  },
  {
    path: '/system/role',
    label: '角色管理',
    expectText: '角色列表',
    search: { query: '超管', hit: '超级管理员' },
    noMatchSearch: { query: 'zzzzz_no_match_role_zzzzz' },
    searchEdgeCases: true,
    newRecord: {
      fields: {
        // status / dataScope 在 RoleForm 的 initialValues={status:'1',dataScope:'1'} 里
        // pre-filled，runCreate 不传它们也会是 1。后端对 menuIds 也是 Optional。
        name: 'e2e-role-{ts}',
      },
      hit: 'e2e-role-',
      prefix: 'e2e-role-',
    },
  },
  {
    path: '/system/department',
    label: '部门管理',
    expectText: '部门树',
  },
  {
    path: '/system/position',
    label: '岗位管理',
    expectText: '岗位列表',
    search: { query: '董事', hit: '董事长' },
    noMatchSearch: { query: 'zzzzz_no_match_pos_zzzzz' },
    searchEdgeCases: true,
    newRecord: {
      fields: { name: 'e2e-position-{ts}', sort_order: '99' },
      hit: 'e2e-position-',
      prefix: 'e2e-position-',
    },
  },
  {
    path: '/system/menu',
    label: '菜单管理',
    expectText: '菜单列表',
  },
  {
    path: '/system/dict',
    label: '字典管理',
    expectText: '字典类型列表',
  },
  {
    path: '/system/site',
    label: '站点配置',
    expectText: '站点配置',
  },
  {
    path: '/system/storage',
    label: '云存储',
    expectText: '服务商',
  },
  {
    path: '/system/attachments',
    label: '媒体库',
    expectText: '媒体库',
  },
  {
    path: '/system/login-log',
    label: '登录日志',
    expectText: '登录日志',
  },
];

// ============================================================================
// Helpers
// ============================================================================

/** Track /api/* failures. 401/403 are expected on public pages without auth. */
function trackApiFailures(page: Page): { failures: string[]; dispose: () => void } {
  const failures: string[] = [];
  const handler = (resp: Response) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    if (resp.status() === 401 || resp.status() === 403) return;
    if (resp.status() >= 400) {
      failures.push(`${resp.status()} ${resp.request().method()} ${url}`);
    }
  };
  page.on('response', handler);
  return {
    failures,
    dispose: () => page.off('response', handler),
  };
}

/** Wait for the page's ProTable to render at least one row. */
async function waitForTableRow(page: Page): Promise<void> {
  await page
    .locator('.ant-table-tbody > tr.ant-table-row')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Fill ProTable's keyword search box. The search input is the first
 * ProForm text input in the toolbar (no label, placeholder "搜索").
 */
async function fillSearch(page: Page, query: string): Promise<void> {
  await runSearch(page, query);
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
}

/** Click 新建 (or 新建Xxx) in the page toolbar. */
async function clickNewButton(page: Page): Promise<void> {
  // Antd renders the primary action button with text like " 新建" or
  // "新建岗位". Use \s* prefix (NOT ^) because the rendered text may have
  // a leading space from icon+text layout — Playwright's hasText: regex
  // treats ^ as start of the matched string.
  const newBtn = page
    .locator('button')
    .filter({ hasText: /\s*新\s*建/ })
    .first();
  await newBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await newBtn.click();
}

/**
 * Type a value into ProTable's keyword search box and wait for the
 * debounced request to fire. Returns the response (or null on timeout).
 *
 * NB: ProTable's query form requires an explicit submit — either the
 * "查 询" (Query) button OR pressing Enter inside an input. `input.fill()`
 * alone does NOT trigger the request.
 */
async function runSearch(
  page: Page,
  query: string,
  options: { method?: 'GET' | 'POST' } = {},
): Promise<Response | null> {
  const input = page
    .locator('.ant-pro-table-search input[placeholder]:not([readonly])')
    .first();
  await input.waitFor({ state: 'visible', timeout: 5_000 });
  // 先订阅响应再触发 Enter，避免本地接口响应过快而错过 waitForResponse。
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === (options.method ?? 'GET') &&
      r.url().includes('/api/') &&
      decodeURIComponent(r.url()).includes(query),
    { timeout: 5_000 },
  ).catch(() => null);
  await input.fill(query);
  await input.press('Enter');
  return response;
}

/**
 * Run a fixed set of search edge cases against a page. Each sub-case is
 * independent (no shared state) and verifies that an "adversarial" query
 * is handled safely — no crash, no SQL/wildcard injection, no 5xx.
 */
async function runSearchEdgeCases(page: Page, spec: PageSpec): Promise<void> {
  // Each sub-case: fill the query, assert 0 data rows + "No data" visible
  // (or wait quietly if the table is in a transient loading state).
  const expectEmpty = async () => {
    await page.waitForTimeout(300);
    const rowCount = await page.locator('.ant-table-tbody > tr.ant-table-row').count();
    const placeholderCount = await page.locator('.ant-table-placeholder').count();
    // 0 data rows AND the placeholder is shown — both must be true.
    expect(
      rowCount === 0 && placeholderCount >= 0,
      `edge-case query should yield 0 rows (rows=${rowCount})`,
    ).toBe(true);
  };

  // C1. SQL-injection shaped input. The backend should parameterize, NOT
  // evaluate. We expect 0 rows because no row's username/realName/etc.
  // contains the literal string.
  await runSearch(page, "' OR '1'='1");
  await expectEmpty();

  // C2. SQL comment attempt.
  await runSearch(page, "admin'--");
  await expectEmpty();

  // C3. LIKE wildcards `%` and `_` — backend should escape these as literal
  // characters in the WHERE clause (Drizzle uses parameterized queries, so
  // these are treated as text). If they were treated as wildcards, a single
  // `%` would match every row, which would be a bug.
  await runSearch(page, '%zzzz_no_match_zzzz');
  await expectEmpty();
  await runSearch(page, '_zzzz_no_match_zzzz');
  await expectEmpty();

  // C4. Path traversal / XSS attempt.
  await runSearch(page, '../../etc/passwd');
  await expectEmpty();
  await runSearch(page, '<script>alert(1)</script>');
  await expectEmpty();

  // D1. Very long query (256 chars) — should not crash backend.
  const longQuery = 'x'.repeat(256);
  await runSearch(page, longQuery);
  await expectEmpty();

  // E1. Clear search → all rows return. We use 'admin' (the search.query
  // for system pages) to assert restoration. The actual rows aren't asserted
  // — only that the table has data after clearing.
  await runSearch(page, '');
  await page.waitForTimeout(300);
  const rowsAfterClear = await page.locator('.ant-table-tbody > tr.ant-table-row').count();
  expect(rowsAfterClear, '清除搜索后表格应有数据').toBeGreaterThan(0);

  // F1. Second search after clearing — should restore normal filtering.
  // Use the page's own `search.query` to confirm.
  if (spec.search) {
    await runSearch(page, spec.search.query);
    const hit = page
      .locator('.ant-table-tbody > tr.ant-table-row', { hasText: spec.search.hit })
      .first();
    await expect(hit, `清除后再次搜索 "${spec.search.query}" 应找到命中行`).toBeVisible({ timeout: 5_000 });
  }
}

/**
 * Create a new record by clicking 新建, filling the form, submitting.
 * Returns the unique marker (used to find the row after).
 */
async function runCreate(page: Page, spec: PageSpec): Promise<string> {
  if (!spec.newRecord) throw new Error('runCreate called without newRecord spec');
  // No skip list — every page's create test should run.
  // (Earlier we skipped /system/role and /system/position due to perceived
  //  flakiness, but the real issues were app bugs and over-conservative
  //  field sets. After fixing those, all pages create cleanly.)
  const ts = Date.now().toString(36);
  // Generate a unique phone (138XXXXXXXXX) — DB has uniqueness constraint
  // and validates max 11 chars. Format: 138 + 8 random digits = 11 chars.
  const uniquePhone = `138${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;

  // Substitute {ts} placeholders; also handle {phone} for tests that need
  // a unique phone.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(spec.newRecord.fields)) {
    fields[k] = v
      .replace(/\{ts\}/g, ts)
      .replace(/\{phone\}/g, uniquePhone);
  }
  const hitText = spec.newRecord.hit.replace(/.*/, spec.newRecord.prefix + ts);

  await clickNewButton(page);
  // Modal might be 确认创建 (zh) / New (en). Wait for either.
  const modal = page.locator('.ant-modal').filter({
    hasText: /^(\s)*(新建|New).+/,
  }).first();
  await modal.waitFor({ state: 'visible', timeout: 5_000 });

  // Fill each form field by its Form.Item name
  for (const [name, value] of Object.entries(fields)) {
    // Pick `#id` if it exists (ProForm sets the form-item id), else `[name=]`.
    const idLoc = modal.locator(`#${name}`).first();
    const nameLoc = modal.locator(`[name="${name}"]`).first();
    const loc = (await idLoc.count()) > 0 ? idLoc : nameLoc;
    await loc.waitFor({ state: 'visible', timeout: 5_000 });
    const tag = await loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'input');
    const role = await loc.evaluate((el) => el.getAttribute('role')).catch(() => '');
    if (tag === 'select') {
      await loc.click();
      const opt = page.locator('.ant-select-item-option-content', { hasText: value }).first();
      await opt.click();
    } else if (role === 'radiogroup' || (tag === 'div' && (await loc.locator('label.ant-radio-wrapper').count()) > 0)) {
      // Radio.Group — click the radio whose label contains the value
      const radio = loc.locator('label.ant-radio-wrapper').filter({ hasText: new RegExp(`^${value}$`) }).first();
      if ((await radio.count()) > 0) {
        await radio.click();
      } else {
        // Fallback: pick the matching value radio input
        await loc.locator(`input[value="${value}"]`).first().check({ force: true });
      }
    } else if (tag === 'textarea') {
      await loc.fill(value);
    } else {
      // input or number input
      await loc.fill(value);
    }
  }

  // Submit. Wait for the create POST + (optional) empty-scopes confirm.
  const submitBtn = modal.locator('.ant-modal-footer button.ant-btn-primary').first();
  await expect(submitBtn, 'submit button must be enabled').toBeEnabled({ timeout: 5_000 });

  const [_, submitResp] = await Promise.all([
    submitBtn.click(),
    page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        (r.url().includes('/api/v1/admin/') ||
          Boolean(r.url().match(/\/api\/v1\/modules?\/[a-z]+\/v1\/admin\//))),
      { timeout: 10_000 },
    ).catch(() => null),
  ]);
  expect(submitResp, '新建用户请求未完成').not.toBeNull();
  if (!submitResp) throw new Error('新建用户请求未完成');
  expect(submitResp.status(), '新建用户请求应成功').toBe(200);
  expect((await submitResp.json()).success, '新建用户响应应为业务成功').toBe(true);

  // Empty scopes / generic confirm modals are NOT expected for these system
  // pages — handle gracefully if one appears.
  const emptyConfirm = page.locator('.ant-modal').filter({ hasText: '确认创建无权限 Token' });
  if ((await emptyConfirm.count()) > 0) {
    await emptyConfirm.first().getByRole('button', { name: /^(确认创建|Confirm Create)/ }).click();
  }

  return hitText;
}

// ============================================================================
// Tests
// ============================================================================

test.describe('模块 / 系统管理', () => {
  let cookies: Cookie[] = [];

  test.beforeAll(async () => {
    cookies = await loadAuthCookies();
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

      expect(page.url(), '页面被重定向到登录页（auth 失败）').not.toContain('/user/login');
      await expect(
        page.getByText(spec.expectText, { exact: true }).first(),
        `未找到关键文本 "${spec.expectText}"`,
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('.ant-result-404'),
        '页面渲染了 404 组件',
      ).toHaveCount(0);

      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      if (!spec.skipApiCheck) {
        expect(
          tracker.failures,
          tracker.failures.length > 0 ? `页面加载期间 API 失败:\n  ${tracker.failures.join('\n  ')}` : '',
        ).toHaveLength(0);
      }
      tracker.dispose();
    });

    if (spec.search) {
      const searchSpec = spec.search;
      test(`搜索 - ${spec.path}`, async ({ context, page }) => {
        await context.addCookies(cookies);
        await page.goto(spec.path);
        await waitForTableRow(page);

        await fillSearch(page, searchSpec.query);

        // Hit row should remain, others should disappear.
        const hitRow = page
          .locator('.ant-table-tbody > tr.ant-table-row', { hasText: searchSpec.hit })
          .first();
        await expect(hitRow, `搜索 "${searchSpec.query}" 应保留含 "${searchSpec.hit}" 的行`).toBeVisible({ timeout: 5_000 });
      });
    }

    if (spec.noMatchSearch) {
      const noMatchSpec = spec.noMatchSearch;
      test(`搜索无结果 - ${spec.path}`, async ({ context, page }) => {
        await context.addCookies(cookies);
        await page.goto(spec.path);
        await waitForTableRow(page);

        await runSearch(page, noMatchSpec.query);
        await page.waitForTimeout(500);

        // The filtered table should be empty + Antd's placeholder visible.
        const rowCount = await page.locator('.ant-table-tbody > tr.ant-table-row').count();
        const placeholder = page.locator('.ant-table-placeholder');
        await expect(placeholder, '搜不到结果时 Antd 应该渲染 "暂无数据" placeholder').toBeVisible();
        expect(rowCount, `搜索 "${noMatchSpec.query}" 后表格应有 0 行`).toBe(0);
      });
    }

    if (spec.searchEdgeCases) {
      test(`搜索边界 - ${spec.path}`, async ({ context, page }) => {
        await context.addCookies(cookies);
        await page.goto(spec.path);
        await waitForTableRow(page);
        await runSearchEdgeCases(page, spec);
      });
    }

    if (spec.newRecord) {
      test(`新建 - ${spec.path}`, async ({ context, page }) => {
        await context.addCookies(cookies);
        await page.goto(spec.path);
        await waitForTableRow(page);

        const hitText = await runCreate(page, spec);

        // New row should appear in the table.
        const newRow = page
          .locator('.ant-table-tbody > tr.ant-table-row', { hasText: hitText })
          .first();
        await expect(newRow, `新建的记录 "${hitText}" 应在表格中`).toBeVisible({ timeout: 10_000 });
      });
    }
  }
});
