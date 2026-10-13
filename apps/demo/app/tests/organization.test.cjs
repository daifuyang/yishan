const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTs, deferred } = require("./helpers/load-ts.cjs");

test("department parent choices exclude the edited node and all descendants", () => {
  const { departmentParentOptions } = loadTs("src/pages/system/dept/form.ts");
  const tree = [
    {
      id: 1,
      name: "总部",
      children: [
        { id: 2, name: "研发", children: [{ id: 3, name: "团队" }] },
        { id: 4, name: "销售" },
      ],
    },
  ];
  assert.deepEqual(
    departmentParentOptions(tree, 2).map((item) => item.value),
    ["0", "1", "4"],
  );
});

test("department payload omits parent for top-level creation and rejects invalid IDs/sort values", () => {
  const { departmentPayload } = loadTs("src/pages/system/dept/form.ts");
  assert.deepEqual(
    departmentPayload({
      name: " 总部 ",
      parentId: "0",
      status: "1",
      sort: "0",
      description: "",
      leaderId: "",
    }),
    {
      name: "总部",
      status: "1",
      sort_order: 0,
      description: "",
    },
  );
  assert.throws(
    () =>
      departmentPayload({
        name: "研发",
        parentId: "0",
        status: "1",
        sort: "-1",
        description: "",
        leaderId: "",
      }),
    /排序/,
  );
  assert.throws(
    () =>
      departmentPayload({
        name: "研发",
        parentId: "0",
        status: "1",
        sort: "0",
        description: "",
        leaderId: "abc",
      }),
    /负责人/,
  );
});

test("dictionary details and login-log details use the supported GET endpoints", async () => {
  const calls = [];
  const boundary = {
    request: async (options) => {
      calls.push(options);
      return { id: 5 };
    },
    requestPaginated() {},
  };
  const dict = loadTs("src/api/admin/dict.ts", { "../client": boundary });
  const logs = loadTs("src/api/admin/loginLog.ts", { "../client": boundary });
  await dict.getAdminDictType(5);
  await dict.getAdminDictData(6);
  await logs.getAdminLoginLog(7);
  assert.deepEqual(
    calls.map(({ method, path }) => ({ method, path })),
    [
      { method: "GET", path: "/api/v1/admin/dicts/types/5" },
      { method: "GET", path: "/api/v1/admin/dicts/data/6" },
      { method: "GET", path: "/api/v1/admin/system/login-logs/7" },
    ],
  );
});

test("login-log dates validate ordering and serialize a complete inclusive date range", () => {
  const { loginLogTimeRange } = loadTs("src/pages/system/login-log/query.ts");
  assert.deepEqual(loginLogTimeRange("2026-10-10", "2026-10-10"), {
    startTime: new Date("2026-10-10T00:00:00").toISOString(),
    endTime: new Date("2026-10-10T23:59:59.999").toISOString(),
  });
  assert.throws(() => loginLogTimeRange("2026-10-11", "2026-10-10"), /开始/);
  assert.throws(() => loginLogTimeRange("2026-02-30", ""), /日期/);
});

test("dictionary payload uses numeric status, API sort field and preserves false default", () => {
  const { dictionaryTypePayload, dictionaryDataPayload } = loadTs("src/pages/system/dict/form.ts");
  const values = {
    name: " 状态 ",
    type: "status",
    label: "正常",
    value: "1",
    status: "0",
    sort: "2",
    remark: "",
    tag: "success",
    isDefault: false,
  };
  assert.deepEqual(dictionaryTypePayload(values), {
    name: "状态",
    type: "status",
    status: 0,
    sort_order: 2,
    remark: "",
  });
  assert.deepEqual(dictionaryDataPayload(values, 4), {
    typeId: 4,
    label: "正常",
    value: "1",
    status: 0,
    sort_order: 2,
    remark: "",
    tag: "success",
    isDefault: false,
  });
  assert.throws(() => dictionaryTypePayload({ ...values, sort: "oops" }), /排序/);
  assert.throws(() => dictionaryDataPayload({ ...values, value: "" }, 4), /键值/);
});

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function mountDepartmentForm(
  api,
  props = {},
  permissions = ["system:department:list", "system:department:create"],
) {
  const slots = [];
  let index = 0;
  let effects = [];
  const react = {
    useState(initial) {
      const slot = index++;
      slots[slot] ??= { value: typeof initial === "function" ? initial() : initial };
      return [
        slots[slot].value,
        (next) => {
          slots[slot].value = typeof next === "function" ? next(slots[slot].value) : next;
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      slots[slot] ??= { current: initial };
      return slots[slot];
    },
    useEffect(fn, deps) {
      const slot = index++;
      if (!slots[slot]?.deps || !deps.every((value, i) => Object.is(value, slots[slot].deps[i]))) {
        const old = slots[slot];
        slots[slot] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[slot].cleanup = fn();
        });
      }
    },
  };
  let completed = 0;
  const component = loadTs("src/pages/system/dept/DepartmentForm.tsx", {
    react,
    "@tarojs/components": { View: "View", Text: "Text", Picker: "Picker" },
    "@tarojs/taro": { showToast: async () => {} },
    "@/components/atoms": { Button: "Button" },
    "@/components/molecules": { FormField: "FormField" },
    "@/components/management": Object.fromEntries(["FormContent", "FormSection", "FormField", "TextField", "TextAreaField", "EnumField", "FormSubmitBar", "LineIcon"].map((name) => [name, name])),
    "./DepartmentForm.module.scss": {},
    "@/hooks": {
      useCanWrite: (...required) =>
        required.every((permission) => permissions.includes(permission)),
    },
    "@/api/admin/dept": api,
      "@/utils/auth-guard": { useCurrentModuleAccess: () => () => true },
    "../_shared/AdminUI": {
      AdminSelect: "AdminSelect",
      AdminNotice: "AdminNotice",
    },
    "@/utils/account-scope": {
      errorMessage: (cause) => cause.message,
    },
  }).default;
  const render = () => {
    index = 0;
    const tree = component({
      onCancel() {},
      onSuccess() {
        completed++;
      },
      ...props,
    });
    const queued = effects;
    effects = [];
    queued.forEach((effect) => {
      effect();
    });
    return nodes(tree);
  };
  render();
  return {
    render,
    completed: () => completed,
    unmount: () =>
      slots.forEach((slot) => {
        slot?.cleanup?.();
      }),
  };
}

test("department saves lock duplicate submissions and retain input after failure", async () => {
  const save = deferred();
  const submitted = [];
  const form = mountDepartmentForm({
    getAdminDeptTree: async () => [],
    createAdminDept: (data) => {
      submitted.push(data);
      return save.promise;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  let tree = form.render();
  tree.find((node) => node.type === "TextField").props.onChange("研发部");
  tree = form.render();
  const button = tree.find((node) => node.type === "FormSubmitBar");
  const one = button.props.onSubmit();
  const two = button.props.onSubmit();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].name, "研发部");
  save.reject(new Error("保存失败"));
  await Promise.all([one, two]);
  tree = form.render();
  assert.equal(tree.find((node) => node.type === "TextField").props.value, "研发部");
  assert.equal(tree.find((node) => node.type === "AdminNotice").props.children, "保存失败");
  assert.equal(form.completed(), 0);
  form.unmount();
});

test("department detail load failure prevents overwriting existing department with incomplete values", async () => {
  let saved = 0;
  const form = mountDepartmentForm(
    {
      getAdminDeptTree: async () => [],
      getAdminDept: async () => {
        throw new Error("详情读取失败");
      },
      updateAdminDept: async () => {
        saved++;
      },
    },
    { department: { id: 3, name: "旧名称", status: "1", sort_order: 0 } },
    ["system:department:list", "system:department:update"],
  );
  await new Promise((resolve) => setImmediate(resolve));
  const button = form
    .render()
    .find((node) => node.type === "FormSubmitBar");
  assert.equal(button.props.submitting, true);
  await button.props.onSubmit();
  assert.equal(saved, 0);
  form.unmount();
});

test("department save remains denied without exact create/update permission", async () => {
  let saved = 0;
  const form = mountDepartmentForm(
    {
      getAdminDeptTree: async () => [],
      createAdminDept: async () => {
        saved++;
      },
    },
    {},
    ["system:department:list"],
  );
  await new Promise((resolve) => setImmediate(resolve));
  let tree = form.render();
  tree.find((node) => node.type === "TextField").props.onChange("研发");
  tree = form.render();
  const button = tree.find((node) => node.type === "FormSubmitBar");
  assert.equal(button.props.submitting, true);
  await button.props.onSubmit();
  assert.equal(saved, 0);
  form.unmount();
});

test("unmounted department form ignores a stale successful save", async () => {
  const save = deferred();
  const form = mountDepartmentForm({
    getAdminDeptTree: async () => [],
    createAdminDept: () => save.promise,
  });
  await new Promise((resolve) => setImmediate(resolve));
  form
    .render()
    .find((node) => node.type === "TextField")
    .props.onChange("研发");
  const pending = form
    .render()
    .find((node) => node.type === "FormSubmitBar")
    .props.onSubmit();
  form.unmount();
  save.resolve({ id: 5 });
  await pending;
  assert.equal(form.completed(), 0);
});



test("department standalone edit loads authoritative parent and saves with its ID", async () => {
  const saved = [];
  const form = mountDepartmentForm({
    getAdminDeptTree: async () => [{id: 1, name: "总部", children: [{id: 3, name: "研发"}]}],
    getAdminDept: async (id) => ({id, name: "研发", parentId: 1, status: "1", sort_order: 0}),
    updateAdminDept: async (id, payload) => saved.push({id, payload}),
  }, {departmentId: 3}, ["system:department:list", "system:department:update"]);
  await new Promise((resolve) => setImmediate(resolve));
  const tree = form.render();
  assert.equal(tree.find((node) => node.type === "TextField").props.value, "研发");
  const picker = tree.find((node) => node.type === "Picker");
  assert.deepEqual(picker.props.range, ["总部"]);
  await tree.find((node) => node.type === "FormSubmitBar").props.onSubmit();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 3);
  assert.equal(saved[0].payload.parentId, 1);
  assert.equal(form.completed(), 1);
  form.unmount();
});
