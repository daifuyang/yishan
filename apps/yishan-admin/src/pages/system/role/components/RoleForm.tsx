import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Tree, Checkbox, Space, Spin } from 'antd';
import { ModalForm, ProFormText, ProFormRadio, ProFormTextArea } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { getMenuTree } from '@/services/yishan-admin/sysMenus';
import type { DataNode } from 'antd/es/tree';
import { getRoleDetail, createRole, updateRole } from '@/services/yishan-admin/sysRoles';

export interface RoleFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysRole>;
  onFinish?: () => Promise<void>;
}

const RoleForm: React.FC<RoleFormProps> = ({
  title,
  trigger,
  initialValues = { status: '1' },
  onFinish,
}) => {
  const [menuTreeLoading, setMenuTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [linkageChecked, setLinkageChecked] = useState(true);
  const [expandAllChecked, setExpandAllChecked] = useState(true);
  const [checkAllChecked, setCheckAllChecked] = useState(false);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const formRef = useRef<any>(undefined);

  const fetchRoleDetail = async (id: number) => {
    const res = await getRoleDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
      setCheckedKeys(res.data?.menuIds || []);
    }
  };

  const buildTree = (nodes: API.menuTreeNode[] = []): DataNode[] => {
    return nodes.map((n) => ({
      title: n.name,
      key: n.id,
      children: n.children ? buildTree(n.children || []) : undefined,
    }));
  };

  const allKeys = useMemo(() => {
    const keys: React.Key[] = [];
    const walk = (list: DataNode[]) => {
      list.forEach((item) => {
        keys.push(item.key);
        if (item.children) walk(item.children as DataNode[]);
      });
    };
    walk(treeData);
    return keys;
  }, [treeData]);

  // 当菜单树数据加载完成后，更新全选状态
  useEffect(() => {
    if (checkedKeys.length > 0 && allKeys.length > 0) {
      setCheckAllChecked(checkedKeys.length === allKeys.length);
    }
  }, [checkedKeys, allKeys]);

  const fetchMenuTree = async () => {
    try {
      setMenuTreeLoading(true);
      const res = await getMenuTree();
      const nodes = buildTree(res.data || []);
      setTreeData(nodes);
      setExpandedKeys(expandAllChecked ? nodes.map((n) => n.key as React.Key) : []);
    } finally {
      setMenuTreeLoading(false);
    }
  };

  if (!trigger) return null;

  return (
    <ModalForm
      formRef={formRef}
      width={520}
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      grid
      initialValues={initialValues}
      onFinish={async (values) => {
        const basePayload = {
          name: values.name,
          description: values.description,
          status: values.status,
          menuIds: checkedKeys as number[],
        };
        if (!initialValues?.id) {
          const res = await createRole(basePayload as API.saveRoleReq);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }
        const res = await updateRole({ id: Number(initialValues.id) }, basePayload as API.updateRoleReq);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
      onOpenChange={(open) => {
        if (open) {
          fetchMenuTree();
          if (initialValues?.id) {
            fetchRoleDetail(initialValues.id);
          } else {
            setCheckedKeys([]);
          }
        }
      }}
    >
      <ProFormText
        name="name"
        label="角色名称"
        rules={[
          { required: true, message: '请输入角色名称' },
          { max: 50, message: '角色名称最多50个字符' },
        ]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="角色状态"
        options={defaultStatusDict}
        colProps={{ span: 24 }}
      />

      <ProFormTextArea
        name="description"
        label="角色描述"
        rules={[{ max: 200, message: '描述最多200个字符' }]}
        fieldProps={{ rows: 4, placeholder: '请输入角色描述' }}
        colProps={{ span: 24 }}
      />

      <Form.Item label="菜单权限">
        <Space style={{ marginBottom: 8 }}>
          <Checkbox
            checked={expandAllChecked}
            onChange={(e) => {
              const v = e.target.checked;
              setExpandAllChecked(v);
              setExpandedKeys(v ? allKeys : []);
            }}
          >展开/折叠</Checkbox>
          <Checkbox
            checked={checkAllChecked}
            onChange={(e) => {
              const v = e.target.checked;
              setCheckAllChecked(v);
              setCheckedKeys(v ? allKeys : []);
            }}
          >全选/全不选</Checkbox>
          <Checkbox
            checked={linkageChecked}
            onChange={(e) => setLinkageChecked(e.target.checked)}
          >父子联动</Checkbox>
        </Space>
        <Spin spinning={menuTreeLoading}>
          <Tree
            checkable
            selectable={false}
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={(checked) => {
              const keys = Array.isArray(checked) ? checked : (checked.checked as React.Key[]);
              setCheckedKeys(keys);
              setCheckAllChecked(keys.length === allKeys.length);
            }}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as React.Key[])}
            checkStrictly={!linkageChecked}
          />
        </Spin>
      </Form.Item>
    </ModalForm>
  );
};

export default RoleForm;
