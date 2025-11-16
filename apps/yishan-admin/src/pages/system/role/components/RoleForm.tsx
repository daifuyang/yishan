import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Radio, Modal, Tree, Checkbox, Space, Spin } from 'antd';
import type { FormInstance } from 'antd';
import { getMenuTree } from '@/services/yishan-admin/sysMenus';
import type { DataNode } from 'antd/es/tree';

export interface RoleFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysRole;
  onCancel: () => void;
  onSubmit: (values: API.saveRoleReq & { menuIds?: number[] }) => Promise<void>;
  confirmLoading: boolean;
}

/**
 * 角色表单组件
 */
const RoleForm: React.FC<RoleFormProps> = ({
  form,
  open,
  title,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const [menuTreeLoading, setMenuTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [linkageChecked, setLinkageChecked] = useState(true);
  const [expandAllChecked, setExpandAllChecked] = useState(false);
  const [checkAllChecked, setCheckAllChecked] = useState(false);

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

  useEffect(() => {
    if (open) {
      fetchMenuTree();
      const preset = initialValues?.menuIds || [];
      setCheckedKeys(preset);
      setCheckAllChecked(preset.length > 0 && preset.length === allKeys.length);
    }
  }, [open]);
  /**
   * 表单提交处理
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({ ...values, menuIds: (checkedKeys as number[]) });
    } catch (_error) {
      // 表单验证失败
    }
  };

  /**
   * Modal 打开后的处理
   */
  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
      if (initialValues) {
        // 编辑模式：设置表单值
        form.setFieldsValue({
          name: initialValues.name,
          description: initialValues.description,
          status: initialValues.status ?? 1,
        });
      } else {
        // 新增模式：重置表单并设置默认值
        form.resetFields();
        form.setFieldsValue({ status: 1 });
      }
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={confirmLoading}
      maskClosable={false}
      destroyOnClose={true}
      afterOpenChange={handleAfterOpenChange}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Form.Item
          name="name"
          label="角色名称"
          rules={[
            { required: true, message: '请输入角色名称' },
            { max: 50, message: '角色名称最多50个字符' },
          ]}
        >
          <Input placeholder="请输入角色名称" />
        </Form.Item>

        {/* 系统默认角色由后端生成或配置，不在此处修改 */}

        <Form.Item
          name="status"
          label="角色状态"
          rules={[{ required: true, message: '请选择角色状态' }]}
        >
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="description"
          label="角色描述"
          rules={[{ max: 200, message: '描述最多200个字符' }]}
        >
          <Input.TextArea rows={4} placeholder="请输入角色描述" />
        </Form.Item>

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
      </Form>
    </Modal>
  );
};

export default RoleForm;