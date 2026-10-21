import { expect, test } from '@playwright/test';

const fields = [
  {
    name: 'password',
    label: '用户密码',
    required: true,
    sensitive: true,
    selector: 'password',
    constraints: { minLength: 6 },
    draftWritable: false,
    invalid: false,
  },
  {
    name: 'avatar',
    label: '头像',
    required: false,
    sensitive: false,
    selector: 'image',
    constraints: {},
    draftWritable: false,
    invalid: false,
  },
];
const tools = [
  'discover_operations',
  'describe_operation',
  'update_form_draft',
].map((name, i) => ({
  type: `tool-${name}`,
  toolCallId: `t${i}`,
  state: 'output-available',
  input: { operationId: 'user.create', keyword: '新建用户' },
  output: {
    ok: true,
    data: {
      operations: [],
      draftId: i === 2 ? 'layout-draft' : undefined,
      formKey: 'user.create',
      draftVersion: 1,
    },
    ...(i === 2
      ? {
          render: {
            kind: 'action.draft',
            payload: {
              draftId: 'layout-draft',
              formKey: 'user.create',
              draftVersion: 1,
            },
          },
        }
      : {}),
    progress: {
      action: ['discover', 'describe', 'draft'][i],
      kind: ['operations', 'form', 'draft'][i],
      subject: '新建用户',
      outcome: 'ready',
    },
  },
}));

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  test(`AI completion layout and explicit confirmation at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    let creates = 0;
    let patches = 0;
    const formData = { phone: '13800000000', realName: '张三' };
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let data: unknown = {};
      if (path.endsWith('/auth/me'))
        data = {
          id: 1,
          username: 'layout-test',
          accessPath: ['/'],
          roleCodes: ['super_admin'],
        };
      else if (path.endsWith('/auth/capabilities'))
        data = {
          permissions: ['*'],
          enabledModuleIds: ['ai', 'demo', 'portal', 'shop'],
        };
      else if (path.endsWith('/menus/tree/authorized'))
        data = [
          {
            id: 1,
            name: '用户管理',
            path: '/system/user',
            component: './system/user',
            type: 1,
            status: '1',
            sort_order: 1,
            hideInMenu: false,
          },
        ];
      else if (path.endsWith('/create-form'))
        data = {
          schemaVersion: 1,
          fields: [
            ...fields,
            {
              name: 'phone',
              label: '手机号码',
              required: true,
              sensitive: false,
              selector: 'text',
              constraints: {},
            },
            {
              name: 'realName',
              label: '真实姓名',
              required: false,
              sensitive: false,
              selector: 'text',
              constraints: {},
            },
          ],
          editableFields: ['phone', 'realName'],
          defaults: {},
          missingFields: [],
        };
      else if (path.endsWith('/create-options'))
        data = { departments: [], roles: [] };
      else if (path.endsWith('/conversations'))
        data = { items: [{ id: 'layout-chat', title: '布局验收' }] };
      else if (path.endsWith('/conversations/layout-chat'))
        data = {
          id: 'layout-chat',
          title: '布局验收',
          messages: [
            ...Array.from({ length: 12 }, (_, i) => ({
              id: `history-${i}`,
              role: 'assistant',
              parts: [
                {
                  type: 'text',
                  text: `历史记录 ${i}：用于检查聊天主滚动区域的长消息。`,
                },
              ],
            })),
            { id: 'prepare', role: 'assistant', parts: tools },
          ],
        };
      else if (path.endsWith('/drafts/layout-draft')) {
        if (route.request().method() === 'PATCH') {
          patches++;
          expect(route.request().postDataJSON().formData).not.toHaveProperty(
            'password',
          );
        }
        data = {
          draftId: 'layout-draft',
          conversationId: 'layout-chat',
          action: 'user.create',
          draftVersion: patches + 1,
          formData,
          completionFields: fields,
          missingFields: [],
          validationErrors: [],
          status: 'collecting',
        };
      } else if (
        /\/admin\/users\/?$/.test(path) &&
        route.request().method() === 'POST'
      ) {
        creates++;
        expect(route.request().postDataJSON().password).toBe('BrowserTest123');
        expect(route.request().postDataJSON().draftSubmission.draftId).toBe(
          'layout-draft',
        );
        data = { id: 999 };
      }
      await route.fulfill({
        json: { success: true, code: 0, message: '', data },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '打开 AI 助手' }).click();
    const expand = page.getByRole('button', { name: '展开为页面' });
    await expand.click();
    if (viewport.width < 769)
      await page.getByRole('button', { name: '对话历史', exact: true }).click();
    await page.getByText('布局验收', { exact: true }).last().click();
    await expect(
      page.getByRole('button', { name: '继续填写表单' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '确认创建' })).toHaveCount(0);
    await expect(page.getByLabel('用户密码', { exact: false })).toHaveCount(0);
    expect(creates).toBe(0);
    await page.getByRole('button', { name: '继续填写表单' }).click();
    const dialog = page.getByRole('dialog', { name: '新建用户' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[value="13800000000"]')).toBeVisible();
    await expect(dialog.locator('input[value="张三"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认创建' })).toHaveCount(0);
    expect(creates).toBe(0);
    await page.getByRole('button', { name: '关闭 AI 助手' }).click();
    const launcher = page.getByRole('button', { name: '打开 AI 助手' });
    const submit = dialog.getByRole('button', { name: /确\s*定|Submit|OK/ });
    const launcherBox = await launcher.boundingBox();
    const submitBox = await submit.boundingBox();
    if (!launcherBox || !submitBox)
      throw new Error('Missing launcher or native submit');
    const overlaps =
      launcherBox.x < submitBox.x + submitBox.width &&
      launcherBox.x + launcherBox.width > submitBox.x &&
      launcherBox.y < submitBox.y + submitBox.height &&
      launcherBox.y + launcherBox.height > submitBox.y;
    expect(overlaps).toBe(false);
    await page.screenshot({
      path: `artifacts/launcher-form-${viewport.width}.png`,
    });
    await dialog.getByRole('button', { name: /确\s*定|Submit|OK/ }).click();
    await expect(dialog.locator('.ant-form-item-explain-error')).toContainText(
      '请输入用户密码',
    );
    expect(creates).toBe(0);
    await dialog.locator('input[type="password"]').fill('BrowserTest123');
    await dialog.getByRole('button', { name: /确\s*定|Submit|OK/ }).click();
    await expect.poll(() => creates).toBe(1);
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(() =>
        launcher.evaluate((el) => getComputedStyle(el.parentElement ?? el).bottom),
      )
      .toBe(viewport.width < 769 ? '16px' : '24px');
  });
}
