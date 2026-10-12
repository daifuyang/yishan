import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test as base } from '@playwright/test';

interface SqlConnection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
}

interface ProductApp {
  listen(options: { host: string; port: number }): Promise<string>;
  close(): Promise<void>;
  inject(options: {
    method: 'POST';
    url: string;
    headers?: Record<string, string>;
    payload: Record<string, unknown>;
  }): Promise<{ statusCode: number; json(): { data: { token: string } } }>;
  system: {
    run(operation: () => Promise<void>): Promise<void>;
    moduleAdministration: {
      setEnabled(id: string, enabled: boolean): Promise<unknown>;
    };
  };
  moduleLoader: { invalidateEnabledCache(): Promise<void> };
}

interface ProductModule {
  migrations?: unknown;
  seed?: (system: ProductApp['system']) => Promise<void>;
}

interface SeedDatabase {
  db: unknown;
  close(): Promise<void>;
}

interface RedisConnection {
  connect(): Promise<void>;
  scan(
    cursor: string,
    ...args: (string | number)[]
  ): Promise<[string, string[]]>;
  del(...keys: string[]): Promise<number>;
  disconnect(): void;
}

export interface ProductRuntime {
  origin: string;
  admin: { username: string; password: string };
  unprivileged: { username: string; password: string };
  setEnabled(id: 'demo' | 'portal' | 'shop', enabled: boolean): Promise<void>;
}

function assertOwnedDatabase(name: string) {
  assert.match(name, /^yishan_admin_test_[a-f0-9]{20}$/);
}

function assertOwnedUser(name: string) {
  assert.match(name, /^yishan_adm_[a-f0-9]{20}$/);
}

async function withProductRuntime(
  use: (runtime: ProductRuntime) => Promise<void>,
) {
  const adminRoot = resolve(__dirname, '../..');
  const repositoryRoot = resolve(adminRoot, '../../..');
  const apiEntry = resolve(adminRoot, '../api/dist/app.js');
  assert(existsSync(apiEntry), 'Build the Demo API before running product E2E');
  assert(
    existsSync(resolve(adminRoot, 'dist/index.html')),
    'Build Demo Admin before running product E2E',
  );
  const compiled = createRequire(apiEntry);
  const { createConnection } = compiled('mysql2/promise') as {
    createConnection(options: Record<string, unknown>): Promise<SqlConnection>;
  };
  const { createDatabase, migrateDatabase } = compiled(
    '@yishan/core-database',
  ) as {
    createDatabase(options: {
      connection: Record<string, unknown>;
      schema: unknown;
    }): SeedDatabase;
    migrateDatabase(db: unknown, manifests: unknown[]): Promise<void>;
  };
  const { schema } = compiled('@yishan/core-system-api/schema') as {
    schema: unknown;
  };
  const { systemModule, seedSystem, finalizeSystemSeed } = compiled(
    '@yishan/core-system-api',
  ) as {
    systemModule: ProductModule;
    seedSystem(): Promise<void>;
    finalizeSystemSeed(): Promise<void>;
  };
  const { demoModules } = compiled('./manifest.js') as {
    demoModules: ProductModule[];
  };
  const { loadConfig } = compiled('./config/index.js') as {
    loadConfig(env: Record<string, string>): {
      connection: string;
      system: {
        ADMIN: { diskPath: string };
        STORAGE: { diskRoot: string };
        [key: string]: unknown;
      };
    };
  };
  const { buildApp } = compiled('./app.js') as {
    buildApp(
      config: ReturnType<typeof loadConfig>,
      modules: ProductModule[],
    ): Promise<ProductApp>;
  };
  const systemRequire = createRequire(
    compiled.resolve('@yishan/core-system-api'),
  );
  const Redis = createRequire(systemRequire.resolve('@fastify/redis'))(
    'ioredis',
  ) as {
    new (options: Record<string, unknown>): RedisConnection;
  };
  const stack = readFileSync(
    resolve(repositoryRoot, 'infra/local-dev-stack.yml'),
    'utf8',
  );
  const rootPassword =
    process.env.YISHAN_TEST_MYSQL_PASSWORD ??
    /^\s*MYSQL_ROOT_PASSWORD:\s*([^\r\n]+)$/m
      .exec(stack)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, '');
  assert(rootPassword, 'Local development MySQL password is missing');
  const suffix = randomBytes(10).toString('hex');
  const name = `yishan_admin_test_${suffix}`;
  const user = `yishan_adm_${suffix}`;
  const userPassword = randomBytes(24).toString('hex');
  const adminPassword = `BrowserAdmin${randomBytes(12).toString('hex')}`;
  const ordinaryPassword = `BrowserUser${randomBytes(12).toString('hex')}`;
  const jwtSecret = randomBytes(32).toString('hex');
  const secrets = [
    rootPassword,
    userPassword,
    adminPassword,
    ordinaryPassword,
    jwtSecret,
  ];
  const root = await createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: rootPassword,
  });
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    db: 15,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  let ownsDatabase = false;
  let ownsUser = false;
  let userHost = '127.0.0.1';
  let database: SeedDatabase | undefined;
  let app: ProductApp | undefined;
  const temporaryRoot = realpathSync(tmpdir());
  let uploadsDirectory: string | undefined;
  try {
    // Root is used only to provision resources whose random identities we own.
    assertOwnedDatabase(name);
    assertOwnedUser(user);
    // Docker observes the loopback client as its bridge gateway. Restrict the
    // temporary SQL account to that exact observed host instead of a wildcard.
    const [clients] = (await root.query(
      "SELECT SUBSTRING_INDEX(USER(), '@', -1) AS clientHost",
    )) as [{ clientHost: string }[], unknown];
    userHost = clients[0].clientHost;
    assert.match(
      userHost,
      /^(localhost|127\.0\.0\.1|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
    );
    await root.query('CREATE DATABASE ??', [name]);
    ownsDatabase = true;
    await root.query('CREATE USER ?@? IDENTIFIED BY ?', [
      user,
      userHost,
      userPassword,
    ]);
    ownsUser = true;
    await root.query('GRANT ALL PRIVILEGES ON ??.* TO ?@?', [
      name,
      user,
      userHost,
    ]);
    const connection = {
      host: '127.0.0.1',
      port: 3306,
      user,
      password: userPassword,
      database: name,
    };
    database = createDatabase({ connection, schema });
    await migrateDatabase(
      database.db,
      [systemModule, ...demoModules].flatMap((module) =>
        module.migrations ? [module.migrations] : [],
      ),
    );
    // No dotenv, product environment, remote host, or persisted login fixture is inherited.
    const config = loadConfig({
      NODE_ENV: 'development',
      LOG_LEVEL: 'silent',
      JWT_SECRET: jwtSecret,
      DATABASE_URL: `mysql://${user}:${userPassword}@127.0.0.1:3306/${name}`,
      SEED_ADMIN_PASSWORD: adminPassword,
      REDIS_URL: 'redis://127.0.0.1:6379/15',
      CACHE_NAMESPACE: name,
      ADMIN_BASE_PATH: '/admin',
      ADMIN_REDIRECT_ROOT: 'false',
    });
    uploadsDirectory = mkdtempSync(
      join(temporaryRoot, 'yishan-admin-uploads-'),
    );
    config.system = {
      ...config.system,
      ADMIN: { ...config.system.ADMIN, diskPath: resolve(adminRoot, 'dist') },
      STORAGE: { ...config.system.STORAGE, diskRoot: uploadsDirectory },
    };
    app = await buildApp(config, demoModules);
    const activeApp = app;
    await activeApp.system.run(async () => {
      await seedSystem();
      for (const module of demoModules) await module.seed?.(activeApp.system);
      await finalizeSystemSeed();
    });
    const login = await activeApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: adminPassword },
    });
    assert.equal(
      login.statusCode,
      200,
      'Seeded administrator could not log in',
    );
    const token = login.json().data.token;
    secrets.push(token);
    const ordinary = await activeApp.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        username: 'browser_person',
        phone: '19900000003',
        password: ordinaryPassword,
      },
    });
    assert.equal(
      ordinary.statusCode,
      200,
      'Could not create permissionless browser account',
    );
    const origin = await activeApp.listen({ host: '127.0.0.1', port: 0 });
    await use({
      origin,
      admin: { username: 'admin', password: adminPassword },
      unprivileged: { username: 'browser_person', password: ordinaryPassword },
      async setEnabled(id, enabled) {
        await activeApp.system.moduleAdministration.setEnabled(id, enabled);
        await activeApp.moduleLoader.invalidateEnabledCache();
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      secrets.reduce(
        (text, secret) => text.replaceAll(secret, '[redacted]'),
        message,
      ),
    );
  } finally {
    try {
      await app?.close();
    } finally {
      try {
        await database?.close();
      } finally {
        try {
          await redis.connect();
          let cursor = '0';
          do {
            const result = await redis.scan(
              cursor,
              'MATCH',
              `${name}:*`,
              'COUNT',
              100,
            );
            cursor = result[0];
            for (const key of result[1]) assert(key.startsWith(`${name}:`));
            if (result[1].length) await redis.del(...result[1]);
          } while (cursor !== '0');
        } finally {
          redis.disconnect();
          try {
            if (ownsDatabase) {
              assertOwnedDatabase(name);
              await root.query('DROP DATABASE ??', [name]);
            }
          } finally {
            try {
              if (ownsUser) {
                assertOwnedUser(user);
                await root.query('DROP USER ?@?', [user, userHost]);
              }
            } finally {
              try {
                await root.end();
              } finally {
                if (uploadsDirectory) {
                  const target = realpathSync(uploadsDirectory);
                  assert.equal(dirname(target), temporaryRoot);
                  assert(basename(target).startsWith('yishan-admin-uploads-'));
                  rmSync(target, { recursive: true, force: true });
                }
              }
            }
          }
        }
      }
    }
  }
}

export const test = base.extend<{ product: ProductRuntime }>({
  product: [
    async ({ browserName }, use) => {
      assert.equal(browserName, 'chromium');
      await withProductRuntime(use);
    },
    { timeout: 120_000 },
  ],
});

export { expect } from '@playwright/test';
