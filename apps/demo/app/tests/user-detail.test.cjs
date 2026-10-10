const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTs, deferred } = require("./helpers/load-ts.cjs");

const USER = {
  id: 2,
  username: "demo",
  realName: "真实姓名",
  nickname: "昵称",
  phone: "13800136721",
  email: "long.email.address@example.com",
  gender: "1",
  genderName: "男",
  status: "1",
  statusName: "启用",
  loginCount: 4,
  lastLoginTime: "2026-09-16T13:58:00Z",
  lastLoginIp: "::1",
  creatorId: 1,
  creatorName: "admin",
  createdAt: "2026-09-01T00:00:00Z",
  updaterId: 1,
  updaterName: "admin",
  updatedAt: "2026-09-02T00:00:00Z",
  roleIds: [37, 52],
  deptIds: [48],
};

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree.type === "function") return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}

function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree) return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree.type === "function") return text(tree.type(tree.props));
  return text(tree.props?.children);
}

function mount({
  permissions = [],
  user = USER,
  api = {},
  confirm = async () => true,
  password = "Newpass123",
  roleLookup,
  deptLookup,
} = {}) {
  const states = [],
    refs = [],
    dependencies = [],
    effects = [],
    cleanups = [];
  const updates = [],
    deletions = [],
    passwords = [],
    confirmations = [],
    toasts = [],
    routes = [];
  let stateIndex = 0,
    refIndex = 0,
    effectIndex = 0,
    tree,
    didShow,
    didHide;
  const Page = loadTs("src/pages/system/user/detail/index.tsx", {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [
          states[index],
          (next) => {
            states[index] = typeof next === "function" ? next(states[index]) : next;
          },
        ];
      },
      useRef(initial) {
        const index = refIndex++;
        refs[index] ??= { current: initial };
        return refs[index];
      },
      useEffect(effect, deps) {
        const index = effectIndex++;
        if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
          dependencies[index] = deps;
          effects.push(() => {
            cleanups[index]?.();
            cleanups[index] = effect();
          });
        }
      },
    },
    "@tarojs/components": { View: "View", Text: "Text", Input: "Input" },
    "@tarojs/taro": {
      useRouter: () => ({ params: { id: String(user.id) } }),
      useDidShow: (callback) => {
        didShow = callback;
      },
      useDidHide: (callback) => {
        didHide = callback;
      },
      showToast: (options) => {
        toasts.push(options.title);
      },
      showModal: async () => ({ confirm: true, content: password }),
    },
    "@/components/atoms": { AppText: "AppText", Avatar: "Avatar", Tag: "Tag", Button: "Button" },
    "@/components/molecules": { PageHeader: "PageHeader", Card: "Card", ListItem: "ListItem" },
    "@/components/feedback": { StateView: "StateView" },
    "@/components/layout": { PageContainer: "PageContainer" },
    "@/utils/auth-guard": { useRequireAuth: () => ({ ready: true, allowed: true }) },
    "@/utils/router": {
      navigateTo: (path) => routes.push(path),
      navigateBack: () => routes.push("back"),
    },
    "@/hooks": {
      useCanWrite: (permission) => permissions.includes(permission),
      confirmAction: (options) => {
        confirmations.push(options);
        return confirm(options);
      },
    },
    "@/api": {
      adminUserApi: {
        getAdminUser: async () => user,
        updateAdminUser: async (id, payload) => {
          updates.push({ id, payload });
          return { ...user, ...payload };
        },
        deleteAdminUser: async (id) => {
          deletions.push(id);
        },
        resetAdminUserPassword: async (id, value) => {
          passwords.push({ id, password: value });
        },
        ...api,
      },
      adminRoleApi: {
        getAdminRole: roleLookup || (async (id) => ({ id, name: id === 37 ? "管理员" : "审核员" })),
      },
      adminDeptApi: { getAdminDept: deptLookup || (async (id) => ({ id, name: "产品部" })) },
    },
    "./index.module.scss": new Proxy({}, { get: (_, key) => key }),
  }).default;
  function render() {
    stateIndex = refIndex = effectIndex = 0;
    tree = Page();
  }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render();
      for (const effect of effects.splice(0)) effect();
      await new Promise(setImmediate);
    }
    render();
  }
  return {
    settle,
    render,
    updates,
    deletions,
    passwords,
    confirmations,
    toasts,
    routes,
    get tree() {
      return tree;
    },
    get nodes() {
      return nodes(tree);
    },
    button(label) {
      return nodes(tree).find((node) => node.props?.["aria-label"] === label);
    },
    async click(label) {
      const button = this.button(label);
      assert.ok(button, `Missing ${label}`);
      await button.props.onClick?.();
      await settle();
    },
    async returnFromEdit() {
      didHide();
      didShow();
      await settle();
    },
  };
}

const UPDATE = ["system:user:update"];
const ALL = [...UPDATE, "system:user:delete", "system:role:list", "system:department:list"];

test("detail exposes only authorized actions and keeps edit on the existing route", async () => {
  const read = mount({ permissions: ["system:user:create"] });
  await read.settle();
  assert.equal(read.button("编辑"), undefined);
  assert.equal(read.button("更多操作"), undefined);
  const update = mount({ permissions: UPDATE });
  await update.settle();
  await update.click("编辑");
  assert.deepEqual(update.routes, ["/pages/system/user/edit/index?id=2"]);
  await update.click("更多操作");
  assert.ok(update.button("重置密码"));
  assert.equal(update.button("删除用户"), undefined);
  await update.click("取消");
  assert.equal(update.button("重置密码"), undefined);
  const remove = mount({ permissions: ["system:user:delete"] });
  await remove.settle();
  assert.equal(remove.button("编辑"), undefined);
  await remove.click("更多操作");
  assert.ok(remove.button("删除用户"));
  assert.equal(remove.button("重置密码"), undefined);
  const protectedUser = mount({ permissions: ["system:user:delete"], user: { ...USER, id: 1 } });
  await protectedUser.settle();
  assert.equal(protectedUser.button("更多操作"), undefined);
});

test("status confirmation is serialized, updates the page, and can be reversed", async () => {
  const pending = deferred();
  const page = mount({ permissions: UPDATE, confirm: () => pending.promise });
  await page.settle();
  const disable = page.button("禁用").props.onClick;
  const first = disable();
  await disable();
  assert.equal(page.confirmations.length, 1);
  pending.resolve(true);
  await first;
  await page.settle();
  assert.deepEqual(page.updates, [{ id: 2, payload: { status: "0" } }]);
  assert.ok(page.button("启用"));
  await page.click("启用");
  assert.deepEqual(page.updates[1], { id: 2, payload: { status: "1" } });
  assert.ok(page.button("禁用"));
});

test("cancelled or failed status changes preserve status and release the submit lock", async () => {
  const cancelled = mount({ permissions: UPDATE, confirm: async () => false });
  await cancelled.settle();
  await cancelled.click("禁用");
  assert.equal(cancelled.updates.length, 0);
  const failed = mount({
    permissions: UPDATE,
    api: {
      updateAdminUser: async () => {
        throw new Error("操作受限");
      },
    },
  });
  await failed.settle();
  await failed.click("禁用");
  assert.ok(failed.button("禁用"));
  assert.ok(failed.toasts.includes("操作受限"));
  await failed.click("禁用");
  assert.equal(failed.confirmations.length, 2);
});

test("more menu resets a supplied valid password, and deletion requires a destructive confirmation", async () => {
  const page = mount({ permissions: ALL });
  await page.settle();
  await page.click("更多操作");
  await page.click("重置密码");
  assert.deepEqual(page.passwords, [{ id: 2, password: "Newpass123" }]);
  await page.click("更多操作");
  await page.click("删除用户");
  assert.deepEqual(page.deletions, [2]);
  assert.equal(page.confirmations[0].confirmColor, "#F53F3F");
  assert.match(page.confirmations[0].content, /不可恢复/);
  const cancelled = mount({ permissions: ALL, confirm: async () => false });
  await cancelled.settle();
  await cancelled.click("更多操作");
  await cancelled.click("删除用户");
  assert.equal(cancelled.deletions.length, 0);
});

test("invalid passwords never reach the API", async () => {
  for (const password of ["short", "12345678", "onlyletters", `${"a".repeat(50)}1`]) {
    const page = mount({ permissions: UPDATE, password });
    await page.settle();
    await page.click("更多操作");
    await page.click("重置密码");
    assert.equal(page.passwords.length, 0);
    assert.ok(page.toasts.length > 0);
  }
});

test("real association names and all records are displayed without mutating the original IP", async () => {
  const page = mount({ permissions: ALL });
  await page.settle();
  const content = text(page.tree);
  for (const value of [
    "管理员",
    "审核员",
    "产品部",
    USER.email,
    "用户 ID",
    "创建时间",
    "更新时间",
    "更新人",
    "本机地址",
  ]) {
    assert.ok(content.includes(value), `Missing ${value}`);
  }
  assert.equal(USER.lastLoginIp, "::1");
});

test("missing lookup permission or a failed association query degrades without exposing IDs", async () => {
  let calls = 0;
  const denied = mount({
    roleLookup: async () => {
      calls++;
      throw new Error("forbidden");
    },
    deptLookup: async () => {
      calls++;
      throw new Error("forbidden");
    },
  });
  await denied.settle();
  assert.equal(calls, 0);
  assert.ok(text(denied.tree).includes("名称暂不可用"));
  const partial = mount({
    permissions: ALL,
    roleLookup: async (id) => {
      if (id === 52) throw new Error("not found");
      return { id, name: "管理员" };
    },
  });
  await partial.settle();
  assert.ok(text(partial.tree).includes("管理员"));
  assert.ok(text(partial.tree).includes("名称暂不可用"));
});

test("returning from edit refreshes the real user detail", async () => {
  let calls = 0;
  const page = mount({
    permissions: UPDATE,
    api: { getAdminUser: async () => ({ ...USER, nickname: ++calls === 1 ? "修改前" : "修改后" }) },
  });
  await page.settle();
  assert.ok(text(page.tree).includes("修改前"));
  await page.returnFromEdit();
  assert.ok(text(page.tree).includes("修改后"));
});

test("H5 reset dialog collects a password and retains input on API failure", async () => {
  const previous = process.env.TARO_ENV;
  process.env.TARO_ENV = "h5";
  try {
    const page = mount({
      permissions: UPDATE,
      api: {
        resetAdminUserPassword: async () => {
          throw new Error("重置受限");
        },
      },
    });
    await page.settle();
    await page.click("更多操作");
    await page.click("重置密码");
    let input = page.nodes.find((node) => node.type === "Input");
    assert.ok(input, "H5 must expose a real password input");
    assert.equal(input.props.value, "");
    input.props.onInput({ detail: { value: "Newpass123" } });
    await page.settle();
    await page.click("确认重置密码");
    input = page.nodes.find((node) => node.type === "Input");
    assert.equal(input.props.value, "Newpass123");
    assert.ok(text(page.tree).includes("重置受限"));
    await page.click("取消重置密码");
    assert.equal(
      page.nodes.find((node) => node.type === "Input"),
      undefined,
    );
  } finally {
    if (previous === undefined) delete process.env.TARO_ENV;
    else process.env.TARO_ENV = previous;
  }
});
