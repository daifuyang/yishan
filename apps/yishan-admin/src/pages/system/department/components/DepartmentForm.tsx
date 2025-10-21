import React, { useState } from 'react';
import { Form, Input, Radio, Modal, TreeSelect } from 'antd';
import type { FormInstance } from 'antd';
import { getDepartmentTree } from '@/services/yishan-admin/sysDepartments';

export interface DepartmentFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysDepartment;
  onCancel: () => void;
  onSubmit: (values: API.sysDepartmentCreateRequest) => Promise<void>;
  confirmLoading: boolean;
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({
  form,
  open,
  title,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<{ title: string; value: number | undefined; children?: any[] }[]>([]);

  const buildTreeData = (list: API.sysDepartment[] = []): any[] => {
    return (list || []).map((d) => ({
      title: d.deptName || `未命名(${d.id})`,
      value: (d.id as number) ?? 0,
      children: buildTreeData(d.children || []),
    }));
  };

  const fetchTree = async () => {
    try {
      setTreeLoading(true);
      const res = await getDepartmentTree();
      const nodes = buildTreeData(res.data?.tree || []);
      setTreeData([{ title: '顶级部门', value: 0, children: nodes }]);
    } catch (err) {
      setTreeData([{ title: '顶级部门', value: 0 }]);
    } finally {
      setTreeLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (error) {
      // ignore
    }
  };

  const handleAfterOpenChange = (opened: boolean) => {
    if (opened) {
      fetchTree();
      if (initialValues) {
        form.setFieldsValue({
          parentId: initialValues.parentId ?? 0,
          deptName: initialValues.deptName,
          deptDesc: initialValues.deptDesc,
          deptType: initialValues.deptType ?? 2,
          status: initialValues.status ?? 1,
          sortOrder: initialValues.sortOrder ?? 0,
          leaderId: initialValues.leaderId,
          phone: initialValues.phone,
          email: initialValues.email,
          address: initialValues.address,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 1, deptType: 2, sortOrder: 0, parentId: 0 });
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
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="parentId" label="上级部门" rules={[{ required: true, message: '请选择上级部门' }]}>
          <TreeSelect
            treeData={treeData}
            allowClear
            placeholder="请选择上级部门"
            treeDefaultExpandAll
            disabled={treeLoading}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item name="deptName" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }, { max: 50, message: '最多50个字符' }]}>
          <Input placeholder="请输入部门名称" />
        </Form.Item>

        <Form.Item name="deptType" label="部门类型" rules={[{ required: true, message: '请选择部门类型' }]}>
          <Radio.Group>
            <Radio value={1}>公司</Radio>
            <Radio value={2}>部门</Radio>
            <Radio value={3}>小组</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="sortOrder" label="排序" rules={[{ required: true, message: '请输入排序值' }]}>
          <Input type="number" placeholder="请输入排序值" />
        </Form.Item>

        <Form.Item name="deptDesc" label="部门描述" rules={[{ max: 200, message: '最多200个字符' }]}>
          <Input.TextArea rows={3} placeholder="请输入部门描述" />
        </Form.Item>

        <Form.Item name="leaderId" label="负责人ID">
          <Input type="number" placeholder="请输入负责人用户ID（可选）" />
        </Form.Item>

        <Form.Item name="phone" label="联系电话" rules={[{ max: 20, message: '最多20个字符' }]}>
          <Input placeholder="请输入联系电话（可选）" />
        </Form.Item>

        <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
          <Input placeholder="请输入邮箱（可选）" />
        </Form.Item>

        <Form.Item name="address" label="地址" rules={[{ max: 200, message: '最多200个字符' }]}>
          <Input.TextArea rows={3} placeholder="请输入地址（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DepartmentForm;