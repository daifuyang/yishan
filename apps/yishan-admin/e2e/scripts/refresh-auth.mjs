#!/usr/bin/env node
/**
 * Pre-login script: hit the API once and save cookies to a fixture file
 * that the test suite consumes. Bypasses the 5/min login rate limit by
 * doing the login once and reusing the cookie across all test runs.
 *
 * Run after `pnpm db:reset` (or whenever the token expires or the
 * cookie origin changes):
 *   node e2e/scripts/refresh-auth.mjs
 *
 * The fixture is consumed by helpers/auth.ts → loadAuthCookies().
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Layout: this script is at e2e/scripts/refresh-auth.mjs; fixture at
// e2e/fixtures/auth.json (two levels up from this script).
const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'auth.json');

const API = 'http://localhost:3000';
const USERNAME = 'admin';
const PASSWORD = 'admin123';
const ADMIN_ORIGIN = 'http://localhost:8000';

async function main() {
  const resp = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!resp.ok) {
    throw new Error(`login failed: HTTP ${resp.status()} ${await resp.text()}`);
  }

  // Capture Set-Cookie headers (Node 18+ has getSetCookie)
  const setCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
  const cookies = setCookies.map((raw) => {
    // Parse "name=value; Path=/; ...; HttpOnly; SameSite=Lax"
    const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const attr = (k) => attrs.some((a) => a.toLowerCase().startsWith(k.toLowerCase()));
    return {
      name,
      value,
      // url is required by Playwright's addCookies (or domain+path).
      url: ADMIN_ORIGIN,
      path: (attrs.find((a) => a.toLowerCase().startsWith('path='))?.split('=')[1]) || '/',
      httpOnly: attr('HttpOnly'),
      secure: attr('Secure'),
      sameSite:
        attrs.find((a) => a.toLowerCase().startsWith('samesite='))?.split('=')[1] || 'Lax',
    };
  });

  if (cookies.length === 0) {
    throw new Error('no Set-Cookie headers in login response');
  }

  const fixture = {
    savedAt: new Date().toISOString(),
    cookieOrigin: ADMIN_ORIGIN,
    cookies,
  };
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  console.log(`wrote ${cookies.length} cookie(s) to ${FIXTURE_PATH}`);
  for (const c of cookies) {
    console.log(`  - ${c.name}=${c.value.slice(0, 24)}... (httpOnly=${c.httpOnly})`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
