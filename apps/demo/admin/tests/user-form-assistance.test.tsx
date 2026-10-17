import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SystemAdminProvider } from '@yishan/core-system-admin';
import UserList from '@yishan/core-system-admin/pages/user';
import {
  clearUserCreateFormHandle,
  peekUserCreateFormHandle,
  registerUserCreateFormHandle,
} from '@yishan/core-system-admin/form-assistance';
import { setAiPrefill } from '@yishan/core-system-admin/ai-prefill';

/**
 * Task 7 行为测试：助手协作的是**同一个原生 UserForm**。
 *
 * 覆盖（对应 brief 的验收清单）：
 *  1. 手动「新建」后，助手只操作那个实例；
 *  2. 没有表单打开时，open() 恰好创建一次；
 *  3. revision 不符 → 拒绝；
 *  4. 实例已关闭 → 拒绝；
 *  5. 打开的是「编辑用户」表单 → 拒绝；
 *  6. snapshot() 永远没有 password；
 *  7. 覆盖用户手动改过的字段需要确认；
 *  8. 非目标字段保持不变。
 */

const mockRequest = jest.fn();

jest.mock('@umijs/max', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

/*
 * 契约类型怎么被钉住（修复轮 1 的结论）：
 *
 * 本文件**不能**写 `import type { UserCreateFormHandle } from '.../form-assistance'`。
 * @umijs/test 的 esbuild transformer 对含 `jest.mock(` 的文件会先跑一遍
 * 只带 `@babel/plugin-transform-modules-commonjs` 的 babel（没有 preset-typescript），
 * 于是「被导入的绑定出现在类型位置」会在 rewrite-live-references 阶段直接抛错 ——
 * `import type {...}` 和 `import { type X }` 两种写法都会失败。
 *
 * 但这不等于必须**镜像**契约：`peekUserCreateFormHandle()` 返回的就是真实的
 * `UserCreateFormHandle`。因此这里让 `currentHandle()` / `openByAssistant()` **推断**
 * 真实类型（下面不写任何类型标注），调用点的 `apply({...})` 由 `tsc --noEmit` 按
 * 真实签名检查 —— 改字段名、放宽 apply、必填化 authorizedFields 都会红。
 * 再加一条运行期形状断言，守住「句柄只有 apply/open/snapshot」。
 */

const EDITABLE_FIELDS = [
  'username',
  'email',
  'phone',
  'realName',
  'nickname',
  'gender',
  'birthDate',
  'status',
  'deptIds',
  'roleIds',
];

const CREATE_FORM = {
  schemaVersion: 1,
  defaults: {},
  editableFields: EDITABLE_FIELDS,
  missingFields: [{ name: 'password', label: '初始密码', required: true, sensitive: true, mustCompleteInForm: true }],
  fields: [
    { name: 'username', label: '登录名称', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'phone', label: '手机号码', required: true, sensitive: false, selector: 'text', constraints: { maxLength: 11 } },
    { name: 'email', label: '邮箱', required: false, sensitive: false, selector: 'email', constraints: {} },
    { name: 'realName', label: '真实姓名', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'nickname', label: '用户昵称', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'password', label: '用户密码', required: true, sensitive: true, selector: 'password', constraints: {} },
    { name: 'gender', label: '用户性别', required: false, sensitive: false, selector: 'enum', constraints: { enum: ['0', '1', '2'] } },
    { name: 'status', label: '状态', required: false, sensitive: false, selector: 'enum', constraints: { enum: ['0', '1', '2'] } },
    { name: 'birthDate', label: '出生日期', required: false, sensitive: false, selector: 'date', constraints: {} },
    { name: 'deptIds', label: '归属部门', required: false, sensitive: false, selector: 'deptTree', constraints: {} },
    { name: 'roleIds', label: '角色', required: false, sensitive: false, selector: 'roleOptions', constraints: {} },
  ],
};

const LIST_ROW = {
  id: 7,
  username: 'existing',
  realName: '已有用户',
  nickname: 'nick',
  email: 'a@b.com',
  phone: '13900000000',
  status: '1',
  gender: '0',
  deptIds: [],
  roleIds: [],
};

beforeEach(() => {
  mockRequest.mockReset();
  clearUserCreateFormHandle();
  mockRequest.mockImplementation(async (
    url: string,
    options?: { params?: Record<string, unknown>; method?: string },
  ) => {
    const params = options?.params ?? {};
    if (String(url).includes('/create-form')) return { success: true, data: CREATE_FORM };
    // 部门树：手改路径要在真实 TreeSelect 上点一个部门，因此必须真的有节点。
    if (String(url).includes('/dept') && String(url).includes('tree')) {
      return { success: true, data: [{ id: 1, name: '总部', parentId: 0 }] };
    }
    if (String(url).includes('/create-options')) {
      const rawDeptIds = params.deptIds;
      const deptIds: number[] = Array.isArray(rawDeptIds)
        ? (rawDeptIds as unknown[]).map(Number)
        : String(rawDeptIds ?? '').split(',').filter(Boolean).map(Number);
      return {
        success: true,
        data: {
          departments: [{ id: 1, name: '总部', parentId: 0 }],
          roles: deptIds.length
            ? [{ id: 3, name: '受限角色' }]
            : [{ id: 2, name: '普通角色' }],
          total: 1,
          page: 1,
          pageSize: 20,
          creatable: true,
        },
      };
    }
    if (String(url).includes('/admin/users/') && options?.method !== 'POST') {
      return { success: true, data: [LIST_ROW], pagination: { total: 1 } };
    }
    return { success: true, data: [] };
  });
});

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'MessageChannel');
const nativeGetComputedStyle = window.getComputedStyle;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  // rc-field-form 用 MessageChannel 派发校验通知，jsdom 没有。
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      port1: { onmessage?: (event: { data: unknown }) => void } = {};
      port2 = {
        postMessage: (data: unknown) => setTimeout(() => this.port1.onmessage?.({ data }), 0),
      };
    },
  });
  // jsdom 没有伪元素布局；表格只量滚动条宽度。
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));
});

afterAll(() => {
  jest.restoreAllMocks();
  if (resizeObserverDescriptor) {
    Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
  if (messageChannelDescriptor) {
    Object.defineProperty(globalThis, 'MessageChannel', messageChannelDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'MessageChannel');
  }
});

function renderUserList() {
  return render(
    <SystemAdminProvider
      value={{
        currentUser: { id: 1, username: 'admin' } as never,
        dictDataMap: {
          user_status: [{ label: '启用', value: '1' }],
          user_gender: [{ label: '未知', value: '0' }],
        },
      }}
    >
      <UserList />
    </SystemAdminProvider>,
  );
}

/** 真实契约类型靠推断拿，因此这里刻意不写类型标注（原因见文件头注释）。 */
function currentHandle() {
  const handle = peekUserCreateFormHandle();
  if (!handle) throw new Error('no user.create form handle registered');
  return handle;
}

function modalCount(): number {
  return document.querySelectorAll('.ant-modal').length;
}

async function openByAssistant() {
  const handle = currentHandle();
  let snapshot!: Awaited<ReturnType<typeof handle.open>>;
  await act(async () => {
    snapshot = await handle.open();
  });
  await waitFor(() => expect(modalCount()).toBe(1));
  return snapshot;
}

test('注册返回注销函数；注销后引用被清空', async () => {
  const snapshot = {
    target: 'user.create' as const,
    instanceId: 'noop',
    revision: 0,
    fields: {},
    dirtyFields: [] as string[],
  };
  const noop = {
    snapshot: () => snapshot,
    open: async () => snapshot,
    apply: async () => ({ applied: true, conflicts: [] as string[] }),
  };
  const unsubscribe = registerUserCreateFormHandle(noop, 42);
  expect(peekUserCreateFormHandle()).toBe(noop);
  unsubscribe();
  expect(peekUserCreateFormHandle()).toBeNull();
});

test('句柄本身只有 open/apply/snapshot：没有 submit / loading / setOpen', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  expect(Object.keys(currentHandle()).sort()).toEqual(['apply', 'open', 'snapshot']);
});

test('没有表单打开时，open() 恰好创建一次', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  expect(modalCount()).toBe(0);

  const first = await openByAssistant();
  const handle = currentHandle();
  let second!: Awaited<ReturnType<typeof handle.open>>;
  await act(async () => {
    second = await handle.open();
  });
  expect(modalCount()).toBe(1);
  expect(second.instanceId).toBe(first.instanceId);
  expect(screen.getAllByText('新建用户')).toHaveLength(1);
});

test('手动「新建」后，助手操作的正是同一个实例，且不出现第二个表单', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /新建/ }));
  });
  await waitFor(() => expect(modalCount()).toBe(1));

  const handle = currentHandle();
  const before = handle.snapshot();
  expect(before.instanceId).toBeTruthy();

  await act(async () => {
    await handle.open();
  });
  expect(modalCount()).toBe(1);
  expect(handle.snapshot().instanceId).toBe(before.instanceId);
});

test('snapshot() 永远不包含 password，密码补丁在入口被拒绝', async () => {
  renderUserList();
  const snapshot = await openByAssistant();
  expect(JSON.stringify(snapshot)).not.toContain('password');

  const handle = currentHandle();
  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: snapshot.instanceId,
      baseRevision: snapshot.revision,
      // 契约里根本没有 password；这一条只能靠运行期拒绝，因此显式越过类型。
      fields: { password: 'secret123' } as unknown as Parameters<typeof handle.apply>[0]['fields'],
    });
  });
  expect(result.applied).toBe(false);
  expect(result.conflicts).toContain('password');
  expect(JSON.stringify(handle.snapshot())).not.toContain('password');
  expect(JSON.stringify(handle.snapshot())).not.toContain('secret123');
});

test('可写字段被应用，非目标字段保持不变', async () => {
  renderUserList();
  const snapshot = await openByAssistant();
  const handle = currentHandle();

  await act(async () => {
    await handle.apply({
      instanceId: snapshot.instanceId,
      baseRevision: snapshot.revision,
      fields: { username: 'zhangsan', realName: '张三' },
    });
  });

  const next = handle.snapshot();
  expect(next.fields.username).toBe('zhangsan');
  expect(next.fields.realName).toBe('张三');
  expect(next.fields.phone).toBeUndefined();
  expect(next.fields.roleIds).toBeUndefined();
  expect(next.revision).toBeGreaterThan(snapshot.revision);
});

test('revision 不符时拒绝应用，且不改动任何字段', async () => {
  renderUserList();
  const first = await openByAssistant();
  const handle = currentHandle();

  await act(async () => {
    await handle.apply({
      instanceId: first.instanceId,
      baseRevision: first.revision,
      fields: { username: 'first' },
    });
  });
  const current = handle.snapshot();

  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: current.instanceId,
      baseRevision: first.revision,
      fields: { username: 'stale' },
    });
  });
  expect(result.applied).toBe(false);
  expect(result.conflicts).toContain('__revision__');
  expect(handle.snapshot().fields.username).toBe('first');
});

test('instanceId 不符时拒绝', async () => {
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: 'some-other-instance',
      baseRevision: handle.snapshot().revision,
      fields: { username: 'nope' },
    });
  });
  expect(result.applied).toBe(false);
  expect(result.conflicts).toContain('__instance__');
});

test('覆盖用户手动改过的字段需要确认；明确授权后才写入', async () => {
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  const usernameInput = await screen.findByPlaceholderText('请输入登录名称');
  await act(async () => {
    fireEvent.change(usernameInput, { target: { value: 'manual-name' } });
  });
  const manual = handle.snapshot();
  expect(manual.fields.username).toBe('manual-name');
  expect(manual.dirtyFields).toContain('username');

  let blocked!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    blocked = await handle.apply({
      instanceId: manual.instanceId,
      baseRevision: manual.revision,
      fields: { username: 'assistant-name' },
    });
  });
  expect(blocked.applied).toBe(false);
  expect(blocked.conflicts).toContain('username');
  expect(handle.snapshot().fields.username).toBe('manual-name');

  let allowed!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    allowed = await handle.apply({
      instanceId: manual.instanceId,
      baseRevision: manual.revision,
      fields: { username: 'assistant-name' },
      authorizedFields: ['username'],
    });
  });
  expect(allowed.applied).toBe(true);
  expect(handle.snapshot().fields.username).toBe('assistant-name');
});

test('确认期间被手改后，迟到的补丁因 revision 不符被拒绝', async () => {
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  // 用户先手改 username —— 助手覆盖它必须先确认。
  const usernameInput = await screen.findByPlaceholderText('请输入登录名称');
  await act(async () => {
    fireEvent.change(usernameInput, { target: { value: 'manual' } });
  });
  const atDecisionTime = handle.snapshot();

  let blocked!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    blocked = await handle.apply({
      instanceId: atDecisionTime.instanceId,
      baseRevision: atDecisionTime.revision,
      fields: { username: 'assistant-name' },
    });
  });
  expect(blocked.applied).toBe(false);
  expect(blocked.conflicts).toContain('username');

  // 用户在「确认」这个停顿期间又改了另一个字段。
  const nicknameInput = await screen.findByPlaceholderText('请输入用户昵称');
  await act(async () => {
    fireEvent.change(nicknameInput, { target: { value: 'manual-nick' } });
  });

  // 用户确认后，助手带着**当时**的版本重试 —— 版本已变，必须被拒。
  let late!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    late = await handle.apply({
      instanceId: atDecisionTime.instanceId,
      baseRevision: atDecisionTime.revision,
      fields: { username: 'assistant-name' },
      authorizedFields: ['username'],
    });
  });
  expect(late.applied).toBe(false);
  expect(late.conflicts).toContain('__revision__');
  expect(handle.snapshot().fields.username).toBe('manual');
  expect(handle.snapshot().fields.nickname).toBe('manual-nick');
});

test('表单关闭后拒绝应用', async () => {
  renderUserList();
  const snapshot = await openByAssistant();
  const handle = currentHandle();

  await act(async () => {
    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement);
  });
  await waitFor(() => expect(modalCount()).toBe(0));

  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: snapshot.instanceId,
      baseRevision: snapshot.revision,
      fields: { username: 'after-close' },
    });
  });
  expect(result.applied).toBe(false);
  expect(result.conflicts).toContain('__closed__');
});

test('打开的是「编辑用户」表单时不提供创建协作', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  await openByAssistant();
  const handle = currentHandle();
  const snapshot = handle.snapshot();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /新建/ }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByText('编辑'));
  });
  await waitFor(() => expect(screen.getByText('编辑用户')).toBeTruthy());

  expect(peekUserCreateFormHandle()).toBeNull();

  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: snapshot.instanceId,
      baseRevision: snapshot.revision,
      fields: { username: 'leaked' },
    });
  });
  expect(result.applied).toBe(false);
});

test('既有的一次性预填也进入同一个表单，不再另挂第二个', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  expect(modalCount()).toBe(0);

  await act(async () => {
    setAiPrefill({
      target: 'user.create',
      fields: { username: 'prefilled', deptId: 1 },
      missing: ['password'],
    });
  });
  await waitFor(() => expect(modalCount()).toBe(1));

  const handle = currentHandle();
  const snapshot = handle.snapshot();
  expect(snapshot.fields.username).toBe('prefilled');
  // 模型给 deptId，表单字段是 deptIds。
  expect(snapshot.fields.deptIds).toEqual([1]);
  expect(await screen.findByText(/还需要你补充：password/)).toBeTruthy();
});

test('助手写入的 deptIds 也会重新验证角色', async () => {
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  // 先在无部门候选下选中「普通角色」(id 2)。
  let applied!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    applied = await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: handle.snapshot().revision,
      fields: { deptIds: [], roleIds: [2] },
    });
  });
  expect(applied.applied).toBe(true);

  // 再让助手把部门改成 1：候选重算后角色 2 不再可授予。
  // setFieldsValue 不触发 onValuesChange，所以这条路径必须自己补校验。
  await act(async () => {
    await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: handle.snapshot().revision,
      fields: { deptIds: [1] },
    });
  });

  expect(
    await screen.findByText('所选角色在当前部门下不再可授予，请重新选择'),
  ).toBeTruthy();
});

test('编辑表单关掉后，创建协作句柄自己回来', async () => {
  renderUserList();
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  await openByAssistant();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /新建/ }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByText('编辑'));
  });
  await waitFor(() => expect(screen.getByText('编辑用户')).toBeTruthy());
  expect(peekUserCreateFormHandle()).toBeNull();

  const editModal = screen.getByText('编辑用户').closest('.ant-modal') as HTMLElement;
  await act(async () => {
    fireEvent.click(editModal.querySelector('.ant-modal-close') as HTMLElement);
  });

  // 创建表单仍旧开在底层，句柄必须恢复，助手才能继续用它。
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  const handle = currentHandle();
  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: handle.snapshot().revision,
      fields: { username: 'after-edit-close' },
    });
  });
  expect(result.applied).toBe(true);
  expect(handle.snapshot().fields.username).toBe('after-edit-close');
});

test('补丁落定时角色重校验已完成：conflict 上报且版本不跳', async () => {
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  let applied!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    applied = await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: handle.snapshot().revision,
      fields: { deptIds: [], roleIds: [2] },
    });
  });
  expect(applied.applied).toBe(true);
  expect(applied.conflicts).not.toContain('roleIds');

  const before = handle.snapshot();
  let result!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    result = await handle.apply({
      instanceId: before.instanceId,
      baseRevision: before.revision,
      fields: { deptIds: [1] },
    });
  });
  // 补丁写成功了，但它让已选角色变得不可授予 —— 必须回报，而不是只留一个表单错误。
  expect(result.applied).toBe(true);
  expect(result.conflicts).toContain('roleIds');

  // 重校验是在 resolve 之前完成的，因此 resolve 后的快照就是稳定版本：
  // 立刻用这个版本发下一版补丁不会遇到假的 __revision__（用户什么都没动）。
  const after = handle.snapshot();
  let next!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    next = await handle.apply({
      instanceId: after.instanceId,
      baseRevision: after.revision,
      fields: { username: 'right-after' },
    });
  });
  expect(next.conflicts).not.toContain('__revision__');
  expect(next.applied).toBe(true);
  expect(handle.snapshot().fields.username).toBe('right-after');
});

test('手改部门触发角色重校验，但版本不会在网络返回后才跳一次', async () => {
  // 缺陷现场：onValuesChange 里 `void revalidateRoles(...)` 没被 await，而它内部会
  // +1 版本。那次 +1 发生在请求返回**之后**，于是「用户刚改完部门 → 助手立刻读快照」
  // 拿到的是过期版本，下一版补丁被 __revision__ 拒掉 —— 而用户明明刚动过手。
  // 修复：手改路径不再补这次 +1（onValuesChange 已经同步加过了）。
  renderUserList();
  await openByAssistant();
  const handle = currentHandle();

  // 先由助手选中「普通角色」(id 2)：不选角色，手改部门就不会产生失效角色。
  await act(async () => {
    await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: handle.snapshot().revision,
      fields: { deptIds: [], roleIds: [2] },
    });
  });

  // 用户自己在原生 TreeSelect 上选部门：这是 onValuesChange，也就是手改路径。
  await waitFor(() => expect(document.querySelector('#deptIds')).not.toBeNull());
  const selector = document.querySelector('#deptIds') as HTMLElement;
  let immediate!: number;
  await act(async () => {
    fireEvent.mouseDown(selector);
  });
  const node = await screen.findByTitle('总部');
  await act(async () => {
    fireEvent.click(node);
    // 同一个 tick 内读版本：此刻请求还没回来，只可能包含同步的那次 +1。
    immediate = handle.snapshot().revision;
  });

  // 重校验落定（角色 2 在部门 1 下不再可授予）。
  await waitFor(() =>
    expect(screen.getByText('所选角色在当前部门下不再可授予，请重新选择')).toBeTruthy(),
  );
  expect(handle.snapshot().fields.deptIds).toEqual([1]);
  // 落定之后版本没有再跳：助手用 immediate 发的下一版补丁不该被拒。
  expect(handle.snapshot().revision).toBe(immediate);

  let next!: Awaited<ReturnType<typeof handle.apply>>;
  await act(async () => {
    next = await handle.apply({
      instanceId: handle.snapshot().instanceId,
      baseRevision: immediate,
      fields: { username: 'after-manual-dept' },
    });
  });
  expect(next.conflicts).not.toContain('__revision__');
  expect(next.applied).toBe(true);
});
