import type { Page } from '@playwright/test';
import { expect, type ProductRuntime, test } from './helpers/product-runtime';

test.use({ video: 'off', trace: 'off' });

const pages = [
  {
    path: '/system/user',
    text: '用户列表',
    api: '/api/v1/admin/users',
    menu: '系统管理',
    item: '用户管理',
  },
  {
    path: '/demo/region',
    text: '懒加载（默认）',
    api: '/api/v1/admin/system/regions',
    menu: '示例插件',
    item: '省市级联',
  },
  {
    path: '/portal/categories',
    text: '分类列表',
    api: '/api/portal/v1/categories/',
    menu: '门户管理',
    item: '分类管理',
  },
  {
    path: '/shop/categories',
    text: '分类列表',
    api: '/api/shop/v1/categories/',
    menu: '商城管理',
    item: '分类管理',
  },
];

async function login(
  page: Page,
  product: ProductRuntime,
  account = product.admin,
) {
  await page.goto(`${product.origin}/admin/user/login`);
  await expect(
    page.getByRole('heading', { name: '欢迎登录系统' }),
  ).toBeVisible();
  await page.getByPlaceholder('用户名', { exact: true }).fill(account.username);
  await page.getByPlaceholder('密码', { exact: true }).fill(account.password);
  const response = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/auth/login',
  );
  await page.getByRole('button', { name: '立即登录', exact: true }).click();
  const status = (await response).status();
  if (status !== 200) {
    await page.getByPlaceholder('密码', { exact: true }).fill('');
  }
  expect(status).toBe(200);
  await expect(page).not.toHaveURL(/\/user\/login/);
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    localStorage.setItem('umi_locale', 'zh-CN'),
  );
});

test('real login mounts System, Demo, Portal and Shop menus and pages after direct refresh', async ({
  page,
  product,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, product);
  for (const name of ['系统管理', '示例插件', '门户管理', '商城管理']) {
    await expect(
      page.getByRole('menuitem', { name, exact: true }),
    ).toBeVisible();
  }
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'yishan_at')?.httpOnly).toBe(
    true,
  );
  for (const entry of pages) {
    if (new URL(page.url()).pathname === `/admin${entry.path}`) {
      const item = page
        .getByRole('menuitem', { name: entry.item, exact: true })
        .first();
      if (!(await item.isVisible())) {
        await page
          .getByRole('menuitem', { name: entry.menu, exact: true })
          .click();
      }
      await item.click();
    } else {
      const link = page.locator(`a[href$="${entry.path}"]`).first();
      if (!(await link.isVisible())) {
        await page
          .getByRole('menuitem', { name: entry.menu, exact: true })
          .click();
      }
      await link.click();
    }
    await expect(page).toHaveURL(`${product.origin}/admin${entry.path}`);
    await expect(
      page.getByText(entry.text, { exact: true }).first(),
    ).toBeVisible();
    const api = page.waitForResponse((response) =>
      new URL(response.url()).pathname.startsWith(entry.api),
    );
    await page.goto(`${product.origin}/admin${entry.path}`);
    expect((await api).status()).toBe(200);
    await expect(
      page.getByText(entry.text, { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(entry.text, { exact: true }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(`${product.origin}/admin${entry.path}`);
  }
  expect(errors).toEqual([]);
});

test('all installed System pages render their tables, forms and shared user modal', async ({
  page,
  product,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, product);
  const tables = [
    ['/system/user', '用户列表'],
    ['/system/role', '角色列表'],
    ['/system/menu', '菜单列表'],
    ['/system/department', '部门树'],
    ['/system/position', '岗位列表'],
    ['/system/dict', '字典类型列表'],
    ['/system/region', '地区列表'],
    ['/system/login-log', '登录日志'],
  ];
  for (const [path, text] of tables) {
    await page.goto(`${product.origin}/admin${path}`);
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
    if (path === '/system/user') {
      await page.getByRole('button', { name: /新建/ }).click();
      const modal = page.getByRole('dialog', { name: '新建用户' });
      await expect(modal.getByPlaceholder('请输入登录名称')).toBeVisible();
      await expect(modal.getByPlaceholder('请输入手机号')).toBeVisible();
      await modal.getByRole('button', { name: /^取\s*消$/ }).click();
      await expect(modal).toBeHidden();
    }
  }
  await page.goto(`${product.origin}/admin/system/site`);
  await expect(page.getByLabel('站点名称')).toBeVisible();
  await expect(page.getByRole('button', { name: /^提\s*交$/ })).toBeVisible();
  const storageConfig = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      '/api/v1/admin/system/storage/config',
  );
  await page.goto(`${product.origin}/admin/system/storage`);
  expect((await storageConfig).status()).toBe(200);
  await expect(page.getByLabel('存储服务商')).toBeVisible();
  await expect(page.getByRole('button', { name: /保\s*存$/ })).toBeVisible();
  await page.goto(`${product.origin}/admin/system/attachments`);
  await expect(page.getByRole('button', { name: /上传/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('anonymous direct business navigation returns to the visible login form', async ({
  page,
  product,
}) => {
  await page.goto(`${product.origin}/admin/portal/categories`);
  await expect(page).toHaveURL(/\/admin\/user\/login/);
  await expect(
    page.getByRole('heading', { name: '欢迎登录系统' }),
  ).toBeVisible();
  await expect(page.getByText('分类列表', { exact: true })).toHaveCount(0);
});

test('permissionless user cannot render System, Demo, Portal or Shop business pages', async ({
  page,
  product,
}) => {
  await login(page, product, product.unprivileged);
  for (const entry of pages) {
    await page.goto(`${product.origin}/admin${entry.path}`);
    await expect(page.getByText('404', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(entry.text, { exact: true })).toHaveCount(0);
    const response = await page.request.get(`${product.origin}${entry.api}`);
    expect(response.status()).toBe(403);
  }
});

test('disabled module hides its menu, blocks direct navigation, and recovers after enabling', async ({
  page,
  product,
}) => {
  await login(page, product);
  await product.setEnabled('portal', false);
  try {
    await page.goto(`${product.origin}/admin/portal/categories`);
    await expect(page.getByText('404', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: '门户管理', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText('分类列表', { exact: true })).toHaveCount(0);
    const response = await page.request.get(
      `${product.origin}/api/portal/v1/categories/`,
    );
    expect(response.status()).toBe(404);
    expect((await response.json()).code).toBe(40400);
  } finally {
    await product.setEnabled('portal', true);
  }
  await page.reload();
  await expect(
    page.getByText('分类列表', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: '门户管理', exact: true }),
  ).toBeVisible();
});

test('Portal category modal creates, edits and deletes real data across refresh', async ({
  page,
  product,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, product);
  await page.goto(`${product.origin}/admin/portal/categories`);
  await page.getByRole('button', { name: '新建分类' }).click();
  const createDialog = page.getByRole('dialog', { name: '新建分类' });
  await expect(createDialog).toBeVisible();
  const name = `Browser category ${Date.now()}`;
  await createDialog.getByPlaceholder('请输入分类名称').fill(name);
  await createDialog
    .getByLabel('URL标识')
    .fill(`browser-category-${Date.now()}`);
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/portal/v1/categories/',
  );
  await createDialog.getByRole('button', { name: /^确\s*定$/ }).click();
  expect((await created).status()).toBe(200);
  await expect(createDialog).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByText('编辑', { exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: '编辑分类' });
  await expect(editDialog.getByPlaceholder('请输入分类名称')).toHaveValue(name);
  const updatedName = `${name} edited`;
  await editDialog.getByPlaceholder('请输入分类名称').fill(updatedName);
  const updated = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname.startsWith('/api/portal/v1/categories/'),
  );
  await editDialog.getByRole('button', { name: /^确\s*定$/ }).click();
  expect((await updated).status()).toBe(200);
  await expect(editDialog).toBeHidden();
  await page.reload();
  const updatedRow = page.getByRole('row').filter({ hasText: updatedName });
  await expect(updatedRow).toBeVisible();
  await updatedRow.getByText('删除', { exact: true }).click();
  const deleted = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      new URL(response.url()).pathname.startsWith('/api/portal/v1/categories/'),
  );
  await page.getByRole('button', { name: /^确\s*定$/ }).click();
  expect((await deleted).status()).toBe(200);
  await expect(updatedRow).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: updatedName }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('shared System media page uploads to isolated local storage and reloads the saved file', async ({
  page,
  product,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, product);
  await page.goto(`${product.origin}/admin/system/attachments`);
  const filename = `admin-v2-browser-${Date.now()}.txt`;
  const bytes = Buffer.from('Admin V2 isolated browser upload\n', 'utf8');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /上传/ }).click();
  const uploaded = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/admin/attachments/',
  );
  await (await chooser).setFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: bytes,
  });
  const response = await uploaded;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    success: boolean;
    data: { originalName: string; url?: string }[];
  };
  expect(body.success).toBe(true);
  expect(body.data[0].originalName).toBe(filename);
  expect(body.data[0].url).toBeTruthy();
  const download = await page.request.get(
    new URL(body.data[0].url ?? '', product.origin).href,
  );
  expect(download.status()).toBe(200);
  expect(await download.body()).toEqual(bytes);
  await page.reload();
  await expect(page.getByText(filename, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
