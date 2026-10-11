const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTs, deferred } = require("./helpers/load-ts.cjs");

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
    "@/hooks": { useCanWrite: (...codes) => codes.every((code) => permissions.includes(code)) },
    "@/utils/auth-guard": { canWriteModuleNow: () => true },
    "@/api/client": { getSessionVersion: () => 0 },
    "@/stores/auth": { useAuthStore: (select) => select({ user: { permissions } }) },
    "@/modules/registry": {
      hasRequiredPermissions: (codes, actual) => codes.every((code) => actual.includes(code)),
    },
    "../_shared/AdminUI": {
      AdminSelect: "AdminSelect",
      AdminNotice: "AdminNotice",
      errorMessage: (error) => error.message,
    },
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

test("position submission locks duplicate taps and retains fields after server rejection", async () => {
  const pending = deferred();
  const requests = [];
  let saved = 0;
  const editor = mountEditor(
    "src/pages/system/position/PositionEditor.tsx",
    "PositionEditor",
    {
      editable: true,
      onClose() {},
      onSaved() {
        saved++;
      },
    },
    {
      "@/api/admin/position": {
        createAdminPosition: (payload) => {
          requests.push(payload);
          return pending.promise;
        },
      },
    },
    ["system:position:create"],
  );
  editor.field("岗位名称").props.onChange("审核主管");
  const save = editor.save().props.onClick;
  save();
  save();
  assert.equal(requests.length, 1);
  pending.reject(new Error("名称已存在"));
  const nodes = await editor.settle();
  assert.equal(editor.field("岗位名称").props.value, "审核主管");
  assert.equal(editor.save().props.loading, false);
  assert.equal(
    nodes.some((node) => node.type === "AdminNotice" && node.props.children[0] === "名称已存在"),
    true,
  );
  assert.equal(saved, 0);
});

test("an editor callback from the previous session cannot submit its draft", async () => {
  let session = 0;
  let creates = 0;
  const editor = mountEditor(
    "src/pages/system/position/PositionEditor.tsx",
    "PositionEditor",
    { editable: true, onClose() {}, onSaved() {} },
    {
      "@/api/client": { getSessionVersion: () => session },
      "@/api/admin/position": {
        createAdminPosition: async () => {
          creates++;
        },
      },
    },
    ["system:position:create"],
  );
  editor.field("岗位名称").props.onChange("旧账号草稿");
  const save = editor.save().props.onClick;
  session++;
  save();
  await editor.settle();
  assert.equal(creates, 0);
});

test("a completed save from the previous session cannot close a new editor", async () => {
  let session = 0;
  let saved = 0;
  const pending = deferred();
  const editor = mountEditor(
    "src/pages/system/position/PositionEditor.tsx",
    "PositionEditor",
    {
      editable: true,
      onClose() {},
      onSaved() {
        saved++;
      },
    },
    {
      "@/api/client": { getSessionVersion: () => session },
      "@/api/admin/position": { createAdminPosition: () => pending.promise },
    },
    ["system:position:create"],
  );
  editor.field("岗位名称").props.onChange("旧账号岗位");
  editor.save().props.onClick();
  session++;
  editor.unmount();
  pending.resolve({ id: 7 });
  await editor.settle();
  assert.equal(saved, 0);
});

test("failed position detail cannot overwrite the record with form defaults", async () => {
  const editor = mountEditor(
    "src/pages/system/position/PositionEditor.tsx",
    "PositionEditor",
    { id: 7, editable: true, onClose() {}, onSaved() {} },
    {
      "@/api/admin/position": {
        getAdminPosition: async () => {
          throw new Error("加载失败");
        },
      },
    },
    ["system:position:update"],
  );
  await editor.settle();
  assert.equal(editor.field("岗位名称").props.disabled, true);
  assert.equal(editor.save().props.disabled, true);
});

test("menu edits preserve hidden flags and omit untouched associated permissions", async () => {
  const requests = [];
  const editor = mountEditor(
    "src/pages/system/menu/MenuEditor.tsx",
    "MenuEditor",
    { id: 7, editable: true, tree: [], onClose() {}, onSaved() {} },
    {
      "@/api/admin/menu": {
        getAdminMenu: async () => ({
          id: 7,
          name: "报表",
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
          permissionCodes: ["reports:read"],
          keepAlive: true,
        }),
        updateAdminMenu: async (id, data) => {
          requests.push({ id, data });
        },
      },
    },
    ["system:menu:update"],
  );
  await editor.settle();
  editor.field("菜单名称").props.onChange("订单报表");
  editor.save().props.onClick();
  await editor.settle();
  assert.deepEqual(requests, [
    {
      id: 7,
      data: {
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
      },
    },
  ]);
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

test("workbench group edits preserve its module even though the field is hidden", async () => {
  const requests = [];
  const editor = mountEditor(
    "src/pages/system/app-menu/AppMenuEditor.tsx",
    "AppMenuEditor",
    { id: 3, editable: true, groups: [], onClose() {}, onSaved() {} },
    {
      "@/api/admin/appMenu": {
        getAdminAppMenu: async () => ({
          id: 3,
          name: "业务",
          type: 0,
          icon: "apps",
          moduleId: "demo",
          sortOrder: 30,
          status: "0",
        }),
        updateAdminAppMenu: async (id, data) => {
          requests.push({ id, data });
        },
      },
    },
    ["system:app-menu:update"],
  );
  await editor.settle();
  editor.field("名称").props.onChange("演示业务");
  editor.save().props.onClick();
  await editor.settle();
  assert.deepEqual(requests, [
    {
      id: 3,
      data: {
        name: "演示业务",
        type: 0,
        parentId: undefined,
        icon: "apps",
        page: undefined,
        moduleId: "demo",
        status: "0",
        sortOrder: 30,
      },
    },
  ]);
});

function pageNodes(page, permissions, records, extraMocks = {}) {
  const mocks = {
    "../coming-soon/index": { __esModule: true, default: () => null },
    "../client": { request() {}, requestPaginated() {} },
    "@/api/client": { getSessionVersion: () => 0 },
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
    "../_shared/AdminUI": {
      AdminPage: "AdminPage",
      withAccountScope: (component) => component,
      AdminSelect: "AdminSelect",
      AdminNotice: "AdminNotice",
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

test("position deletion rechecks current permission after confirmation", async () => {
  let allowed = true;
  let deletes = 0;
  const nodes = pageNodes(
    "position",
    ["system:position:delete"],
    [{ id: 8, name: "主管", status: "1" }],
    {
      "@/utils/auth-guard": {
        useRequireAuth: () => ({ ready: true, allowed: true }),
        canWriteModuleNow: () => allowed,
      },
      "@/api/admin/position": {
        deleteAdminPosition: async () => {
          deletes++;
        },
      },
      "@/hooks": {
        useCanWrite: (...required) =>
          required.every((code) => ["system:position:delete"].includes(code)),
        useListPagination: () => ({
          list: [{ id: 8, name: "主管", status: "1" }],
          keyword: "",
          filters: {},
          finished: true,
          refresh() {},
        }),
        confirmAction: async () => {
          allowed = false;
          return true;
        },
      },
    },
  );
  nodes.find((node) => node.type === "Button" && node.props.children === "删除").props.onClick();
  await new Promise(setImmediate);
  assert.equal(deletes, 0);
});

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
  const actions = pageActions("position", [], [{ id: 1, name: "主管", status: "1" }]);
  assert.equal(actions.includes("详情"), true);
  assert.equal(
    actions.some((label) => ["新建", "编辑", "删除", "禁用"].includes(label)),
    false,
  );
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
