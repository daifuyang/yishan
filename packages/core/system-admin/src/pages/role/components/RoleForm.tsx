import type {} from '../../../types/index';
import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Checkbox, Form, Input, Space, Spin, Tabs, Tree, Typography } from 'antd';
import {
  DrawerForm,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useSystemAdmin } from '../../../runtime';
import type { DataNode } from 'antd/es/tree';
import { getMenuTree } from '../../../services/generated/sysMenus';
import { getAppMenuTree } from '../../../services/generated/sysAppMenus';
import { getDeptTree } from '../../../services/generated/sysDepts';
import {
  createRole,
  getRoleDetail,
  updateRole,
} from '../../../services/generated/sysRoles';

export interface RoleFormProps {
  title: string;
  trigger?: React.JSX.Element;
  initialValues?: Partial<SystemAPI.sysRole>;
  onFinish?: () => Promise<void>;
}

const DATA_SCOPE_OPTIONS = [
  { label: '全部数据', value: '1' },
  { label: '本部门数据', value: '2' },
  { label: '本部门及子部门数据', value: '3' },
  { label: '仅本人数据', value: '4' },
  { label: '自定义数据', value: '5' },
];

/** 「自定义数据」的档位值。与后端 DATA_SCOPE_CUSTOM 一致，改动须同步。 */
const DATA_SCOPE_CUSTOM = '5';

function toDeptTreeData(nodes: SystemAPI.deptTreeNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: node.status === '1' ? node.name : `${node.name}（已禁用）`,
    children:
      node.children && node.children.length > 0
        ? toDeptTreeData(node.children)
        : undefined,
  }));
}

function flattenMenuTree(nodes: SystemAPI.menuTreeNode[]): SystemAPI.menuTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenuTree(node.children || [])]);
}

interface MenuAuthorizationTitleProps {
  node: SystemAPI.menuTreeNode;
}

const MenuAuthorizationTitle: React.FC<MenuAuthorizationTitleProps> = ({
  node,
}) => <Typography.Text>{node.name}</Typography.Text>;

const RoleForm: React.FC<RoleFormProps> = ({
  title,
  trigger,
  initialValues = { status: '1', dataScope: '1' },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const [activeTab, setActiveTab] = useState('basic');
  const [menuTreeLoading, setMenuTreeLoading] = useState(false);
  const [menuTree, setMenuTree] = useState<SystemAPI.menuTreeNode[]>([]);
  const [checkedMenuKeys, setCheckedMenuKeys] = useState<React.Key[]>([]);
  const [expandedMenuKeys, setExpandedMenuKeys] = useState<React.Key[]>([]);
  const [expandAll, setExpandAll] = useState(true);
  const [appMenuTree, setAppMenuTree] = useState<SystemAPI.appMenuNode[]>([]);
  const [checkedAppEntryKeys, setCheckedAppEntryKeys] = useState<React.Key[]>(
    [],
  );
  const [checkedPermissionCodes, setCheckedPermissionCodes] = useState<
    string[]
  >([]);
  const [deptTree, setDeptTree] = useState<SystemAPI.deptTreeNode[]>([]);
  const [dataScope, setDataScope] = useState<string>(
    String(initialValues.dataScope ?? '1'),
  );
  const [authorizationSearch, setAuthorizationSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [parentChildLinked, setParentChildLinked] = useState(true);
  const deferredSearch = useDeferredValue(
    authorizationSearch.trim().toLowerCase(),
  );

  const { initialState } = useSystemAdmin();
  const defaultStatusDict: Array<{ label: string; value: string }> =
    initialState?.dictDataMap?.default_status || [];
  const allNodes = useMemo(() => flattenMenuTree(menuTree), [menuTree]);
  const deptTreeData = useMemo(() => toDeptTreeData(deptTree), [deptTree]);
  const menuNodeById = useMemo(
    () => new Map(allNodes.map((node) => [node.id, node])),
    [allNodes],
  );
  const actionNodes = useMemo(
    () => allNodes.filter((node) => node.type === 2),
    [allNodes],
  );
  const allMenuKeys = useMemo(
    () => allNodes.filter((node) => node.type !== 2).map((node) => node.id),
    [allNodes],
  );
  const checkedActionIds = useMemo(
    () =>
      new Set(
        actionNodes
          .filter((node) =>
            (node.permissionCodes || []).some((code) =>
              checkedPermissionCodes.includes(code),
            ),
          )
          .map((node) => node.id),
      ),
    [actionNodes, checkedPermissionCodes],
  );

  const menuAllChecked =
    allMenuKeys.length > 0 &&
    allMenuKeys.every((menuId) => checkedMenuKeys.includes(menuId));
  const actionAllChecked =
    actionNodes.length > 0 && actionNodes.every((node) => checkedActionIds.has(node.id));

  useEffect(() => {
    if (expandAll) setExpandedMenuKeys(allMenuKeys);
  }, [allMenuKeys, expandAll]);

  const syncActionPermissions = (keys: React.Key[]) => {
    const selectedIds = new Set(keys.map(Number));
    const allActionCodes = new Set(
      actionNodes.flatMap((node) => node.permissionCodes || []),
    );
    const selectedCodes = actionNodes
      .filter((node) => selectedIds.has(node.id))
      .flatMap((node) => node.permissionCodes || []);
    setCheckedPermissionCodes((current) => [
      ...current.filter((code) => !allActionCodes.has(code)),
      ...new Set(selectedCodes),
    ]);
  };
  const updateAuthorizationSelection = (keys: Iterable<number>) => {
    const nextKeys = [...new Set(keys)];
    setCheckedMenuKeys(nextKeys);
    syncActionPermissions(nextKeys);
  };
  const collectDescendantNodes = (node: SystemAPI.menuTreeNode): SystemAPI.menuTreeNode[] =>
    (node.children || []).flatMap((child) => [child, ...collectDescendantNodes(child)]);
  const handleMenuCheck = (checked: React.Key[] | { checked: React.Key[] }) => {
    const nextCheckedIds = new Set(
      (Array.isArray(checked) ? checked : checked.checked).map(Number),
    );
    const currentCheckedIds = new Set(checkedMenuKeys.map(Number));
    const next = new Set(nextCheckedIds);

    if (parentChildLinked) {
      for (const id of nextCheckedIds) {
        if (currentCheckedIds.has(id)) continue;
        const node = menuNodeById.get(id);
        if (!node) continue;
        collectDescendantNodes(node).forEach((item) => {
          next.add(item.id);
        });
      }
      for (const id of currentCheckedIds) {
        if (nextCheckedIds.has(id)) continue;
        const node = menuNodeById.get(id);
        if (!node) continue;
        [node, ...collectDescendantNodes(node)].forEach((item) => {
          next.delete(item.id);
        });
      }
    }
    updateAuthorizationSelection(next);
  };
  useEffect(() => {
    if (!actionNodes.length) return;
    const actionIds = actionNodes
      .filter((node) => (node.permissionCodes || []).some((code) => checkedPermissionCodes.includes(code)))
      .map((node) => node.id);
    if (!actionIds.length) return;
    setCheckedMenuKeys((current) => [...new Set([...current, ...actionIds])]);
  }, [actionNodes, checkedPermissionCodes]);
  const authorizationTreeData = useMemo(() => {
    const matches = (node: SystemAPI.menuTreeNode) =>
      `${node.name} ${(node.permissionCodes || []).join(' ')}`
        .toLowerCase()
        .includes(deferredSearch);
    const build = (nodes: SystemAPI.menuTreeNode[]): DataNode[] =>
      nodes
        .flatMap((node) => {
          const visibleChildren = build(node.children || []);
          const ownVisible =
            (!deferredSearch || matches(node)) &&
            (!onlySelected || checkedMenuKeys.includes(node.id));
          const isVisible =
            !deferredSearch && !onlySelected
              ? true
              : ownVisible || visibleChildren.length > 0;
          if (!isVisible) return [];
          return [{
            key: node.id,
            title: <MenuAuthorizationTitle node={node} />,
            children: visibleChildren.length > 0 ? visibleChildren : undefined,
          }];
        });
    return build(menuTree);
  }, [
    menuTree,
    checkedMenuKeys,
    deferredSearch,
    onlySelected,
  ]);

  const fetchMenuTree = async () => {
    setMenuTreeLoading(true);
    try {
      const response = await getMenuTree();
      setMenuTree(response.data || []);
    } finally {
      setMenuTreeLoading(false);
    }
  };
  const fetchAppMenuTree = async () => {
    const response = await getAppMenuTree();
    const data = response.data || [];
    setAppMenuTree(data);
    return data;
  };
  const appEntryIds = useMemo(
    () =>
      new Set(
        appMenuTree.flatMap((group) =>
          (group.children || []).map((entry) => entry.id),
        ),
      ),
    [appMenuTree],
  );
  const appMenuTreeData = useMemo<DataNode[]>(
    () =>
      appMenuTree.map((group) => ({
        key: group.id,
        title: group.status === '1' ? group.name : `${group.name}（已禁用）`,
        children: (group.children || []).map((entry) => ({
          key: entry.id,
          title:
            entry.status === '1' ? entry.name : `${entry.name}（已禁用）`,
        })),
      })),
    [appMenuTree],
  );
  const fetchRoleDetail = async (
    id: number,
    appTree: SystemAPI.appMenuNode[],
  ) => {
    const response = await getRoleDetail({ id });
    if (!response.success || !response.data) return;
    formRef.current?.setFieldsValue(response.data);
    setDataScope(String(response.data.dataScope ?? '1'));
    // 自定义档位（5）保存的是部门 id 列表；回显必须与保存用同一份数据，
    // 否则「改了没生效」会被误判成保存失败。
    formRef.current?.setFieldsValue({ deptIds: response.data.deptIds || [] });
    setCheckedMenuKeys(response.data.menuIds || []);
    setCheckedPermissionCodes(response.data.permissionCodes || []);
    const entryIds = new Set(
      appTree.flatMap((group) => (group.children || []).map((entry) => entry.id)),
    );
    setCheckedAppEntryKeys(
      (response.data.appMenuIds || []).filter((menuId) => entryIds.has(menuId)),
    );
  };
  const handleOpenChange = async (open: boolean) => {
    if (!open) return;
    setActiveTab('basic');
    setDataScope(String(initialValues.dataScope ?? '1'));
    formRef.current?.setFieldsValue({ deptIds: [] });
    setAuthorizationSearch('');
    setOnlySelected(false);
    if (!initialValues.id) {
      setCheckedMenuKeys([]);
      setCheckedPermissionCodes([]);
      setCheckedAppEntryKeys([]);
    }
    const [, appTree] = await Promise.all([fetchMenuTree(), fetchAppMenuTree()]);
    // 部门树只有自定义档位用得上，但仍随抽屉打开一起拉取，避免切换档位时再等一次。
    try {
      const deptResponse = await getDeptTree();
      setDeptTree(deptResponse.data || []);
    } catch {
      setDeptTree([]);
    }
    if (initialValues.id) await fetchRoleDetail(Number(initialValues.id), appTree);
  };

  if (!trigger) return null;

  return (
    <DrawerForm
      formRef={formRef}
      title={title}
      trigger={trigger}
      initialValues={initialValues}
      drawerProps={{
        destroyOnHidden: true,
        mask: { closable: false },
        width: 920,
        styles: { body: { padding: '0 24px', overflow: 'hidden' } },
      }}
      onOpenChange={handleOpenChange}
      onFinish={async (values) => {
        const payload = {
          name: values.name,
          description: values.description,
          status: values.status,
          dataScope: values.dataScope,
          // 只有「自定义」档位才带部门列表；其他档位显式传空数组，
          // 让后端清掉历史遗留的 sys_role_dept 行，而不是留着生效。
          deptIds:
            String(values.dataScope) === DATA_SCOPE_CUSTOM
              ? ((values.deptIds as number[]) || [])
              : [],
          menuIds: (checkedMenuKeys as number[]).filter(
            (id) => menuNodeById.get(id)?.type !== 2,
          ),
          permissionCodes: checkedPermissionCodes,
          appMenuIds: [
            ...checkedAppEntryKeys.map(Number),
            ...appMenuTree
              .filter((group) =>
                (group.children || []).some((entry) =>
                  checkedAppEntryKeys.includes(entry.id),
                ),
              )
              .map((group) => group.id),
          ],
        };
        const response = initialValues.id
          ? await updateRole(
              { id: Number(initialValues.id) },
              payload as SystemAPI.updateRoleReq,
            )
          : await createRole(payload as SystemAPI.saveRoleReq);
        if (!response.success) return false;
        await onFinish?.();
        return true;
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'basic',
            label: '角色信息',
            children: (
              <>
                <ProFormText
                  name="name"
                  label="角色名称"
                  rules={[
                    { required: true, message: '请输入角色名称' },
                    { max: 50, message: '角色名称最多50个字符' },
                  ]}
                />
                <ProFormRadio.Group
                  name="status"
                  label="角色状态"
                  options={defaultStatusDict}
                />
                <ProFormSelect
                  name="dataScope"
                  label="数据权限"
                  options={DATA_SCOPE_OPTIONS}
                  fieldProps={{
                    onChange: (value: string) => {
                      setDataScope(value);
                      // 离开自定义档位时清空勾选，否则下次切回来会看到
                      // 一个看不见来源的部门集合。
                      if (value !== DATA_SCOPE_CUSTOM) {
                        formRef.current?.setFieldsValue({ deptIds: [] });
                      }
                    },
                  }}
                  rules={[{ required: true, message: '请选择数据权限' }]}
                />
                {dataScope === DATA_SCOPE_CUSTOM && (
                  <Form.Item
                    name="deptIds"
                    label="授权部门"
                    valuePropName="checkedKeys"
                    rules={[
                      {
                        validator: (_rule, value) =>
                          Array.isArray(value) && value.length > 0
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error('自定义数据权限至少需要一个部门'),
                              ),
                      },
                    ]}
                    extra="勾选后，该角色在这些部门及其用户上生效。父节点与子节点联动。"
                  >
                    <Tree
                      checkable
                      treeData={deptTreeData}
                      checkStrictly={false}
                      selectable={false}
                      defaultExpandAll
                    />
                  </Form.Item>
                )}
                <ProFormTextArea
                  name="description"
                  label="角色描述"
                  rules={[{ max: 200, message: '描述最多200个字符' }]}
                  fieldProps={{ rows: 5, placeholder: '请输入角色描述' }}
                />
              </>
            ),
          },
          {
            key: 'authorization',
            label: '功能授权',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="勾选菜单控制页面入口；勾选操作控制可执行范围。修改后点击“确定”统一保存。"
                  style={{ marginBottom: 16 }}
                />
                <Space wrap size={[16, 8]} style={{ marginBottom: 8 }}>
                  <Input.Search
                    allowClear
                    placeholder="搜索菜单或操作"
                    value={authorizationSearch}
                    onChange={(event) =>
                      setAuthorizationSearch(event.target.value)
                    }
                    style={{ width: 280 }}
                  />
                  <Checkbox
                    checked={onlySelected}
                    onChange={(event) => setOnlySelected(event.target.checked)}
                  >
                    仅看已授权
                  </Checkbox>
                  <Checkbox
                    checked={expandAll}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setExpandAll(checked);
                      setExpandedMenuKeys(checked ? allMenuKeys : []);
                    }}
                  >
                    展开全部
                  </Checkbox>
                  <Checkbox
                    checked={parentChildLinked}
                    onChange={(event) =>
                      setParentChildLinked(event.target.checked)
                    }
                  >
                    父子联动
                  </Checkbox>
                </Space>
                <Space wrap size={[16, 8]} style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary">批量选择</Typography.Text>
                  <Checkbox
                    checked={menuAllChecked}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        updateAuthorizationSelection([]);
                        return;
                      }
                      updateAuthorizationSelection([
                        ...allMenuKeys,
                        ...actionNodes.map((node) => node.id),
                      ]);
                    }}
                  >
                    全选菜单
                  </Checkbox>
                  <Checkbox
                    checked={actionAllChecked}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        updateAuthorizationSelection([]);
                        return;
                      }
                      updateAuthorizationSelection([
                        ...allMenuKeys,
                        ...actionNodes.map((node) => node.id),
                      ]);
                    }}
                  >
                    全选功能
                  </Checkbox>
                </Space>
                <Spin spinning={menuTreeLoading}>
                  <div
                    style={{
                      minHeight: 360,
                      maxHeight: 'calc(100vh - 330px)',
                      overflow: 'auto',
                      paddingRight: 8,
                    }}
                  >
                    <Tree
                      checkable
                      selectable={false}
                      treeData={authorizationTreeData}
                      checkedKeys={checkedMenuKeys}
                      expandedKeys={expandedMenuKeys}
                      checkStrictly
                      onExpand={(keys) =>
                        setExpandedMenuKeys(keys as React.Key[])
                      }
                      onCheck={handleMenuCheck}
                      style={{ marginTop: 0 }}
                    />
                  </div>
                </Spin>
              </>
            ),
          },
          {
            key: 'app-workbench',
            label: 'App 工作台',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="勾选该角色在 App 工作台可见的应用入口，与 Web 菜单授权相互独立。"
                  style={{ marginBottom: 16 }}
                />
                <div
                  style={{
                    minHeight: 360,
                    maxHeight: 'calc(100vh - 330px)',
                    overflow: 'auto',
                  }}
                >
                  <Tree
                    checkable
                    selectable={false}
                    defaultExpandAll
                    key={appMenuTree.length}
                    treeData={appMenuTreeData}
                    checkedKeys={checkedAppEntryKeys}
                    onCheck={(checked) =>
                      setCheckedAppEntryKeys(
                        (Array.isArray(checked)
                          ? checked
                          : checked.checked
                        ).filter((key) => appEntryIds.has(Number(key))),
                      )
                    }
                  />
                </div>
              </>
            ),
          },
        ]}
      />
    </DrawerForm>
  );
};

export default RoleForm;
