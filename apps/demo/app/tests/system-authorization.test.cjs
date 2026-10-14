const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTs } = require("./helpers/load-ts.cjs");

function mountEditor(entry, name, props, apiMocks, permissions = []) {
  const slots = [];
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [
        slots[index].value,
        (value) => {
          slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (slots[index]?.deps?.every((value, i) => Object.is(value, deps[i]))) return;
      const cleanup = slots[index]?.cleanup;
      slots[index] = { deps };
      effects.push(() => {
        cleanup?.();
        slots[index].cleanup = effect();
      });
    },
  };
  const editor = loadTs(entry, {
    react,
    "@tarojs/components": { View: "View", Text: "Text" },
    "@tarojs/taro": { showToast() {} },
    "@/components/atoms": { Button: "Button" },
    "@/components/molecules": { FormField: "FormField" },
    "@/components/management": Object.fromEntries(
      ["FormField", "EnumField", "FormError", "FormSection", "TextField", "TextAreaField", "SwitchField"].map(
        (name) => [name, name],
      ),
    ),
    "@/hooks": { useCanWrite: (...codes) => codes.every((code) => permissions.includes(code)) },
    "@/utils/auth-guard": { canWriteModuleNow: () => true },
    "@/api/client": { getSessionVersion: () => 0 },
    "@/stores/auth": { useAuthStore: (select) => select({ user: { permissions } }) },
    "@/modules/registry": {
      hasRequiredPermissions: (codes, actual) => codes.every((code) => actual.includes(code)),
    },
    "@/utils/account-scope": {
      errorMessage: (error) => error.message,
    },
    "./RoleEditor.module.scss": {},
    ...apiMocks,
  })[name];
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)];
  function flush() {
    while (dirty) {
      dirty = false;
      cursor = 0;
      tree = editor(props);
      const pending = effects;
      effects = [];
      pending.forEach((effect) => {
        effect();
      });
    }
    return nodes(tree);
  }
  flush();
  return {
    flush,
    field: (label) =>
      flush().find((node) => node.type === "FormField" && node.props.label === label),
    save: () => flush().find((node) => node.type === "Button" && node.props.children === "保存"),
    settle: async () => {
      await new Promise(setImmediate);
      return flush();
    },
    unmount: () =>
      slots.forEach((slot) => {
        slot?.cleanup?.();
      }),
  };
}

// 菜单表单已拆成独立页面，载荷组装集中在 model.ts，这里直接断言它的契约。
test("menu edits preserve hidden flags and omit untouched associated permissions", () => {
  const { menuPayload } = loadTs("src/pages/system/menu/model.ts", {
    "@/api/client": { getSessionVersion: () => 0 },
    "@/stores/auth": { useAuthStore: (select) => select({ user: { permissions } }) },
    "@/utils/auth-guard": { canWriteModuleNow: () => true },
    "@/hooks": { confirmAction: async () => true },
    "@/api/admin/menu": { deleteAdminMenu: async () => {} },
  });
  const payload = menuPayload({
    name: "订单报表",
    type: 1,
    parentId: 4,
    path: "/reports",
    icon: "chart",
    component: "./reports",
    status: "0",
    sort: "30",
    // 这些开关在表单里没有暴露，但必须原样带回，否则一次改名就把配置抹了
    hideInMenu: true,
    isDefaultAction: true,
    isExternalLink: false,
    keepAlive: true,
  });
  assert.deepEqual(payload, {
    name: "订单报表",
    type: 1,
    parentId: 4,
    path: "/reports",
    icon: "chart",
    component: "./reports",
    status: "0",
    sort_order: 30,
    hideInMenu: true,
    isDefaultAction: true,
    isExternalLink: false,
    keepAlive: true,
  });
  // 关联功能已拆到独立页，编辑菜单的载荷不应再带 permissionCodes
  assert.equal("permissionCodes" in payload, false);
});

test("role basic edits omit inaccessible grants and preserve existing data scope", async () => {
  const requests = [];
  const editor = mountEditor(
    "src/pages/system/role/RoleEditor.tsx",
    "RoleEditor",
    { id: 7, editable: true, onClose() {}, onSaved() {} },
    {
      "@/api/admin/role": {
        getAdminRole: async () => ({
          id: 7,
          name: "审核员",
          description: "审核订单",
          status: "1",
          dataScope: "5",
          menuIds: [10],
          appMenuIds: [40, 42],
          permissionCodes: ["orders:approve"],
        }),
        updateAdminRole: async (id, data) => {
          requests.push({ id, data });
        },
      },
      "@/api/admin/menu": {},
      "@/api/admin/appMenu": {},
    },
    ["system:role:update", "system:role:grant"],
  );
  await editor.settle();
  editor.field("角色名称").props.onChange("高级审核员");
  editor.save().props.onClick();
  await editor.settle();
  assert.deepEqual(requests, [
    { id: 7, data: { name: "高级审核员", description: "审核订单", status: "1", dataScope: "5" } },
  ]);
});

test("unchecking a single role permission leaves the other selected permissions intact", async () => {
  const editor = mountEditor(
    "src/pages/system/role/RoleEditor.tsx",
    "RoleEditor",
    { id: 7, editable: true, onClose() {}, onSaved() {} },
    {
      "@/api/admin/role": {
        getAdminRole: async () => ({
          id: 7,
          name: "审核员",
          description: "审核订单",
          status: "1",
          dataScope: "1",
          menuIds: [],
          appMenuIds: [],
          permissionCodes: ["orders:approve", "orders:export"],
        }),
        updateAdminRole: async () => {},
      },
      "@/api/admin/menu": {
        getAdminPermissionCatalog: async () => [
          { code: "orders:approve", label: "审批订单", description: "审批订单" },
          { code: "orders:export", label: "导出订单", description: "导出订单" },
        ],
      },
      "@/api/admin/appMenu": {},
    },
    ["system:role:update", "system:role:grant", "system:permission:catalog"],
  );
  await editor.settle();

  const approve = editor.field("审批订单");
  const exportPerm = editor.field("导出订单");
  assert.ok(approve, "应渲染 orders:approve 的开关");
  assert.ok(exportPerm, "应渲染 orders:export 的开关");
  assert.equal(approve.props.checked, true, "初始 orders:approve 应处于勾选状态");
  assert.equal(exportPerm.props.checked, true, "初始 orders:export 应处于勾选状态");

  // 走真实的 catalog 路径（RoleEditor.tsx 第 294 行所在的分支）。
  approve.props.onChange(false);

  // 目标项必须取消勾选，幸存项必须保留——这正是上一轮回归漏掉的两个半边。
  // 只断言其中一项会让 `x !== x` 那种把整个数组清空的错误溜过去。
  assert.equal(
    editor.field("审批订单").props.checked,
    false,
    "被取消的 orders:approve 必须从勾选集合中移除",
  );
  assert.equal(
    editor.field("导出订单").props.checked,
    true,
    "orders:export 仍应保留在勾选集合中，filter 错误会把幸存项一起清空",
  );
});

// 工作台表单已拆成独立页面，载荷组装集中在 model.ts，这里直接断言它的契约。
test("workbench group edits preserve its module even though the field is hidden", () => {
  const { appMenuPayload } = loadTs("src/pages/system/app-menu/model.ts", {
    "@/api/client": { getSessionVersion: () => 0 },
    "@/stores/auth": { useAuthStore: (select) => select({ user: { permissions } }) },
    "@/utils/auth-guard": { canWriteModuleNow: () => true },
    "@/hooks": { confirmAction: async () => true },
    "@/api/admin/appMenu": { deleteAdminAppMenu: async () => {} },
  });
  const payload = appMenuPayload({
    name: "演示业务",
    type: 0,
    icon: "apps",
    page: "",
    moduleId: "demo",
    status: "0",
    sort: "30",
  });
  assert.deepEqual(payload, {
    name: "演示业务",
    type: 0,
    parentId: undefined,
    icon: "apps",
    page: undefined,
    moduleId: "demo",
    status: "0",
    sortOrder: 30,
  });
});

function pageNodes(page, permissions, records, extraMocks = {}) {
  const mocks = {
    "../client": { request() {}, requestPaginated() {} },
    "@/api/client": { getSessionVersion: () => 0 },
    "@/stores/auth": { useAuthStore: (select) => select({ user: { permissions } }) },
    react: {
      useState: (value) => [value, () => {}],
      useRef: (value) => ({ current: value }),
      useEffect() {},
    },
    "@tarojs/components": { View: "View", Text: "Text" },
    "@tarojs/taro": { showToast() {}, useDidShow() {} },
    "@/components/atoms": { Button: "Button" },
    "@/components/molecules": { FormField: "FormField" },
    "@/components/feedback": { StateView: "StateView" },
    "@/api/admin/role": {
      listAdminRoles: async () => ({ data: [], pagination: { total: 0 } }),
      getAdminRole: async () => ({}),
      createAdminRole: async () => ({}),
      updateAdminRole: async () => ({}),
      deleteAdminRole: async () => ({}),
    },
    "@/api/admin/menu": {
      getAdminMenuTree: async () => [],
      getAdminPermissionCatalog: async () => [],
    },
    "@/components/management": {
      ManagementPage: "ManagementPage",
      ManagementPageHeader: "ManagementPageHeader",
      ManagementHeaderAction: "ManagementHeaderAction",
      ManagementFilterBar: "ManagementFilterBar",
      ManagementSearchBar: "ManagementSearchBar",
      ManagementFilterTabs: "ManagementFilterTabs",
      ManagementList: "ManagementList",
      ManagementCell: "ManagementCell",
      ManagementStates: "ManagementStates",
      ManagementListFooter: "ManagementListFooter",
    },
    "./model": {
      roleStatus: (role) =>
        role.status === "1" ? { label: "启用", variant: "success" } : { label: "禁用", variant: "default" },
      roleTypeLabel: (role) => (role.isSystemDefault ? "系统角色" : "自定义角色"),
      DATA_SCOPE_LABELS: {
        "1": "全部数据",
        "2": "本部门数据",
        "3": "本部门及子部门",
        "4": "仅本人数据",
        "5": "自定义数据",
      },
    },
    "@/utils/auth-guard": {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: () => true,
    },
    "@/hooks": {
      useCanWrite: (...required) => required.every((code) => permissions.includes(code)),
      confirmAction: async () => false,
      useListPagination: () => ({
        list: records,
        total: records.length,
        loading: false,
        error: null,
        keyword: "",
        filters: {},
        finished: true,
      }),
    },
    "@/utils/account-scope": {
      withAccountScope: (component) => component,
      errorMessage: String,
    },
    "./RoleEditor": { RoleEditor: "RoleEditor" },
    "./PositionEditor": { PositionEditor: "PositionEditor" },
    ...extraMocks,
  };
  const tree = loadTs(`src/pages/system/${page}/index.tsx`, mocks).default();
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children), ...nodes(value.props?.action)];
  return nodes(tree);
}

function pageActions(page, permissions, records) {
  return pageNodes(page, permissions, records)
    .filter((node) => node.type === "Button")
    .map((node) => node.props.children);
}

test("role list keeps row actions out and gates create behind grant permission", () => {
  const record = { id: 1, name: "系统管理员", status: "1", dataScope: "1", isSystemDefault: true };

  const withoutGrant = pageNodes(
    "role",
    ["system:role:create", "system:role:update", "system:role:delete"],
    [record],
  );
  assert.deepEqual(
    withoutGrant.filter((node) => node.type === "Button").map((node) => node.props.children),
    [],
    "列表行内不应出现任何操作按钮",
  );
  assert.equal(
    withoutGrant.filter((node) => node.type === "ManagementHeaderAction").length,
    0,
    "缺少 system:role:grant 时不应提供新建入口",
  );

  const withGrant = pageNodes(
    "role",
    ["system:role:create", "system:role:update", "system:role:delete", "system:role:grant"],
    [record],
  );
  const create = withGrant.filter((node) => node.type === "ManagementHeaderAction");
  assert.equal(create.length, 1);
  assert.equal(create[0].props.label, "新建");
  assert.equal(
    withGrant.filter((node) => node.type === "ManagementCell").length,
    1,
    "每条记录只承载一个详情入口",
  );
});

test("position read-only users can inspect but cannot mutate", () => {
  const nodes = pageNodes("position", [], [{ id: 1, name: "主管", status: "1" }], {
    "@tarojs/taro": { useDidShow() {}, useDidHide() {} },
    "@/components/management": Object.fromEntries(["ManagementPage", "ManagementPageHeader", "ManagementHeaderAction", "ManagementFilterBar", "ManagementFilterTriggers", "ManagementFilterClear", "ManagementSearchBar", "ManagementList", "ManagementCell", "ManagementStates", "ManagementListFooter", "BottomSelectSheet"].map(key => [key, key])),
  });
  assert.equal(nodes.filter(node => node.type === "ManagementCell" && typeof node.props.onClick === "function").length, 1);
  assert.equal(nodes.filter(node => node.type === "ManagementHeaderAction").length, 0);
  assert.equal(nodes.filter(node => node.type === "Button").length, 0);
});

test("role authorization excludes action IDs, derives app groups, and keeps standalone permissions", () => {
  const { buildRoleAuthorization } = loadTs("src/pages/system/role/authorization.ts");
  const result = buildRoleAuthorization(
    { menuIds: [1, 2, 3], permissionCodes: ["todo:write", "system:user:list"], appMenuIds: [11] },
    [{ id: 1, type: 0, children: [{ id: 2, type: 1, children: [{ id: 3, type: 2 }] }] }],
    [
      {
        id: 10,
        type: 0,
        children: [
          { id: 11, type: 1 },
          { id: 12, type: 1 },
        ],
      },
    ],
  );
  assert.deepEqual(result, {
    menuIds: [1, 2],
    permissionCodes: ["todo:write", "system:user:list"],
    appMenuIds: [11, 10],
  });
});

test("app-menu reorder moves the complete sibling set and refuses boundary moves", () => {
  const { moveAppMenu } = loadTs("src/pages/system/app-menu/order.ts");
  const tree = [
    {
      id: 1,
      children: [
        { id: 4, parentId: 1 },
        { id: 5, parentId: 1 },
        { id: 6, parentId: 1 },
      ],
    },
    { id: 2 },
  ];
  assert.deepEqual(moveAppMenu(tree, { id: 5, parentId: 1 }, 1), {
    parentId: 1,
    orderedIds: [4, 6, 5],
  });
  assert.deepEqual(moveAppMenu(tree, { id: 2 }, -1), { parentId: undefined, orderedIds: [2, 1] });
  assert.equal(moveAppMenu(tree, { id: 4, parentId: 1 }, -1), null);
});

test("menu parent options exclude own subtree to prevent cycles", () => {
  const { menuParentOptions } = loadTs("src/pages/system/menu/parents.ts");
  const tree = [
    {
      id: 1,
      name: "父级",
      children: [{ id: 2, name: "当前", children: [{ id: 3, name: "下级" }] }],
    },
    { id: 4, name: "其他" },
  ];
  assert.deepEqual(menuParentOptions(tree, 2), [
    { value: "1", label: "父级" },
    { value: "4", label: "其他" },
  ]);
});

test("role requests transmit all three authorization dimensions without defaulting partial updates", async () => {
  const emitted = [];
  const api = loadTs("src/api/admin/role.ts", {
    "../client": {
      request: async (options) => {
        emitted.push(options);
        return { id: 9 };
      },
    },
  });
  await api.createAdminRole({
    name: "审核员",
    menuIds: [1],
    appMenuIds: [10, 11],
    permissionCodes: ["todo:write"],
  });
  await api.updateAdminRole(9, { status: "0" });
  assert.deepEqual(emitted, [
    {
      method: "POST",
      path: "/api/v1/admin/roles",
      data: { name: "审核员", menuIds: [1], appMenuIds: [10, 11], permissionCodes: ["todo:write"] },
    },
    { method: "PUT", path: "/api/v1/admin/roles/9", data: { status: "0" } },
  ]);
});

test("position preserves API sort_order and filters through paginated transport", async () => {
  const emitted = [];
  const transport = async (options) => {
    emitted.push(options);
    return {};
  };
  const api = loadTs("src/api/admin/position.ts", {
    "../client": { request: transport, requestPaginated: transport },
  });
  await api.listAdminPositions({ page: 2, pageSize: 20, status: "1" });
  await api.updateAdminPosition(8, { name: "主管", sort_order: 30, description: "负责审核" });
  assert.deepEqual(emitted, [
    {
      method: "GET",
      path: "/api/v1/admin/positions",
      query: { page: 2, pageSize: 20, status: "1" },
    },
    {
      method: "PUT",
      path: "/api/v1/admin/positions/8",
      data: { name: "主管", sort_order: 30, description: "负责审核" },
    },
  ]);
});

test("menu and workbench transports keep their separate trees and reorder contract", async () => {
  const emitted = [];
  const transport = async (options) => {
    emitted.push(options);
    return {};
  };
  const mocks = { "../client": { request: transport, requestPaginated: transport } };
  const menus = loadTs("src/api/admin/menu.ts", mocks);
  const workbench = loadTs("src/api/admin/appMenu.ts", mocks);
  await menus.getAdminMenuTree();
  await menus.getAdminPermissionCatalog();
  await workbench.getAdminAppMenuTree();
  await workbench.reorderAdminAppMenus({ parentId: 2, orderedIds: [5, 4, 6] });
  assert.deepEqual(emitted, [
    { method: "GET", path: "/api/v1/admin/menus/tree" },
    { method: "GET", path: "/api/v1/admin/permissions/catalog" },
    { method: "GET", path: "/api/v1/admin/app-menus/tree" },
    {
      method: "POST",
      path: "/api/v1/admin/app-menus/reorder",
      data: { parentId: 2, orderedIds: [5, 4, 6] },
    },
  ]);
});
