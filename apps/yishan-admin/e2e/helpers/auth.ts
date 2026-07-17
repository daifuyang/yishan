/**
 * Auth helper for yishan-admin E2E tests.
 *
 * Why this exists:
 *   yishan-admin uses HttpOnly cookies (yishan_at / yishan_rt) for auth
 *   (see src/utils/token.ts). The browser auto-sends these on same-origin
 *   /api requests; the vite dev server proxies /api → :3000 with
 *   `changeOrigin: true` which preserves cookies.
 *
 * What it does:
 *   1. loginViaApiAndCaptureCookies — POST /api/v1/auth/login, capture
 *      Set-Cookie values as Playwright `Cookie[]` shaped for addCookies().
 *   2. loadAuthCookies — fast-path via fixtures/auth.json (avoids the
 *      5/min login rate limit). Falls back to a live API login if the
 *      fixture is missing or stale.
 *   3. buildLocaleInitScript — force `navigator.language = 'zh-CN'` so the
 *      umi i18n plugin (baseNavigator: true) renders Chinese strings
 *      (e.g. "API Token 管理" instead of "API Token Management").
 *
 * Usage (in a test file):
 *
 *   import { loadAuthCookies, buildLocaleInitScript } from '../helpers/auth';
 *
 *   let cookies: Cookie[];
 *   test.beforeAll(async () => { cookies = await loadAuthCookies(); });
 *   test.beforeEach(async ({ context }) => {
 *     await context.addCookies(cookies);
 *     await context.addInitScript(buildLocaleInitScript());
 *   });
 */

import { request, type APIRequestContext } from '@playwright/test';
import type { Cookie } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Playwright runs tests from the apps/yishan-admin dir, so this resolves to
// apps/yishan-admin/e2e/fixtures/auth.json. Avoid __dirname: ts-node / Playwright
// loader's source-map handling can rewrite it inconsistently.
const FIXTURE_PATH = join(process.cwd(), 'e2e', 'fixtures', 'auth.json');

const DEFAULT_API = 'http://localhost:3000';
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123';
const DEFAULT_COOKIE_ORIGIN = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoginCookiesOptions {
  username?: string;
  password?: string;
  apiBaseURL?: string;
  cookieOrigin?: string;
}

interface FixtureFile {
  savedAt: string;
  cookieOrigin: string;
  cookies: Array<{
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  }>;
}

/**
 * Try the fixture file first (fast, no rate-limit pressure); fall back to a
 * live API login if missing or stale.
 */
export async function loadAuthCookies(): Promise<Cookie[]> {
  if (existsSync(FIXTURE_PATH)) {
    try {
      const raw = readFileSync(FIXTURE_PATH, 'utf8');
      const fixture = JSON.parse(raw) as FixtureFile;
      if (fixture.cookies?.length && fixture.cookies.every((c) => c.value)) {
        // Cast to Playwright's full Cookie type — the fixture's stripped
        // shape (url + httpOnly + secure + sameSite) is sufficient at runtime;
        // domain/path/expires are derived from url when omitted.
        return fixture.cookies.map((c) => ({
          name: c.name,
          value: c.value,
          url: c.url ?? fixture.cookieOrigin,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
        })) as unknown as Cookie[];
      }
    } catch {
      // fall through to live login
    }
  }
  return loginViaApiAndCaptureCookies();
}

/**
 * POST /api/v1/auth/login and return the Set-Cookie headers shaped as
 * Playwright `Cookie[]` ready for `context.addCookies()`.
 */
export async function loginViaApiAndCaptureCookies(
  options: LoginCookiesOptions = {},
): Promise<Cookie[]> {
  const apiBaseURL = options.apiBaseURL ?? DEFAULT_API;
  const cookieOrigin = options.cookieOrigin ?? DEFAULT_COOKIE_ORIGIN;
  const username = options.username ?? DEFAULT_USER;
  const password = options.password ?? DEFAULT_PASS;

  const ctx: APIRequestContext = await request.newContext({ baseURL: apiBaseURL });
  try {
    const resp = await ctx.post('/api/v1/auth/login', {
      data: { username, password },
    });
    if (!resp.ok()) {
      throw new Error(`login failed: HTTP ${resp.status()} ${await resp.text()}`);
    }
    const state = await ctx.storageState();
    // Playwright's addCookies refuses cookies with BOTH url AND domain/path.
    // We provide url only; domain and path are derived from it.
    return state.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: cookieOrigin,
      // Strip domain/path: Playwright's addCookies() refuses cookies
      // that have both url AND domain/path. Since we provide url,
      // domain and path are derived from it.
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })) as unknown as Cookie[];
  } finally {
    await ctx.dispose();
  }
}

/**
 * Init script: force the browser locale to zh-CN so umi-max's i18n plugin
 * (baseNavigator: true) resolves to the production Chinese strings.
 * Pass to `context.addInitScript()` in `test.beforeEach`.
 */
export function buildLocaleInitScript(): string {
  return `
    try {
      Object.defineProperty(navigator, 'language', { get: () => 'zh-CN', configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'], configurable: true });
    } catch (e) { /* ignore */ }
  `;
}

// Re-export the fixture path so refresh scripts can locate it without
// hard-coding.
export const AUTH_FIXTURE_PATH = FIXTURE_PATH;
