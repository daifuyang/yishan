const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTs } = require("./helpers/load-ts.cjs");

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

function renderPage(page, permissions) {
  const user = {
    id: 2,
    username: "user",
    realName: "User",
    phone: "123",
    status: "1",
    gender: "0",
    loginCount: 0,
  };
  let stateIndex = 0;
  let actions;
  const mocks = {
    '@/utils/account-scope': { withAccountScope: (component) => component },
    react: {
      useMemo: (compute) => compute(),
      useEffect() {},
      useState: () => [[user, false, null][stateIndex++], () => {}],
    },
    "@tarojs/components": { View: "View", Text: "Text", Input: "Input" },
    "@tarojs/taro": {
      useDidShow() {},
      useRouter: () => ({ params: { id: "2" } }),
      showActionSheet: async ({ itemList }) => {
        actions = itemList;
        return { tapIndex: -1 };
      },
    },
    "@/components/atoms": { AppText: "AppText", Avatar: "Avatar", Tag: "Tag", Button: "Button" },
    "@/components/molecules": {
      ListItem: "ListItem",
      Card: "Card",
    },
    "@/components/feedback": { StateView: "StateView" },
    "@/components/organisms": { TabBar: "TabBar" },
    "@/components/layout": { PageContainer: "PageContainer" },
    "@/components/management": {
      ManagementPage: "ManagementPage",
      ManagementPageHeader: "ManagementPageHeader",
      ManagementHeaderAction: "ManagementHeaderAction",
      ManagementFilterBar: "ManagementFilterBar",
      ManagementSearchBar: "ManagementSearchBar",
      ManagementList: "ManagementList",
      ManagementCell: "ManagementCell",
      ManagementStates: "ManagementStates",
      ManagementListFooter: "ManagementListFooter",
      DetailContent: "DetailContent",
      DetailHero: "DetailHero",
      DetailSection: "DetailSection",
      DetailRow: "DetailRow",
      DetailGroupList: "DetailGroupList",
      BottomActionBar: "BottomActionBar",
      ActionSheet: "ActionSheet",
      PromptDialog: "PromptDialog",
      LineIcon: "LineIcon",
    },
    "@/utils/auth-guard": { useRequireAuth: () => ({ ready: true, allowed: true }) },
    "@/utils/router": { navigateTo() {}, navigateBack() {} },
    "@/hooks": {
      useCanWrite: (...required) =>
        required.every((permission) => permissions.includes(permission)),
      confirmAction: async () => false,
      useListPagination: () => ({
        list: [user],
        total: 1,
        loading: false,
        refreshing: false,
        loadingMore: false,
        finished: true,
        error: null,
        keyword: "",
        filters: {},
        setKeyword() {},
        setFilters() {},
        refresh() {},
      }),
    },
    "@/api": { adminUserApi: {} },
    "./index.module.scss": {},
    "./UserFilters": { UserFilterBar: "UserFilterBar" },
  };
  const rendered = loadTs(`src/pages/system/user/${page}`, mocks).default();
  return { nodes: elements(rendered), getActions: () => actions };
}

test("create permission shows only the new-user entry, update permission shows status/password actions", async () => {
  const headerAction = (nodes) =>
    nodes.find((node) => node.type === "ManagementPageHeader")?.props?.action;

  const create = renderPage("index.tsx", ["system:user:list", "system:user:create"]);
  assert.equal(headerAction(create.nodes)?.type, "ManagementHeaderAction");
  assert.equal(headerAction(create.nodes)?.props.label, "新建");
  await create.nodes
    .find((node) => typeof node.props?.onLongPress === "function")
    .props.onLongPress();
  assert.equal(create.getActions(), undefined);

  const update = renderPage("index.tsx", ["system:user:list", "system:user:update"]);
  assert.equal(headerAction(update.nodes), undefined);
  await update.nodes
    .find((node) => typeof node.props?.onLongPress === "function")
    .props.onLongPress();
  assert.deepEqual(update.getActions(), ["禁用", "重置密码"]);
});
