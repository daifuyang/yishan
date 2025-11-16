import React, { useEffect, useState } from 'react';
import { Form, Input, Radio, Modal, TreeSelect } from 'antd';
import type { FormInstance, TreeDataNode } from 'antd';
import { getDeptTree } from '@/services/yishan-admin/sysDepts';
import type { DataNode } from 'antd/es/tree';

export interface DepartmentFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysDept;
  onCancel: () => void;
  onSubmit: (values: API.createDeptReq) => Promise<void>;
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

  const [treeData, setTreeData] = useState<API.deptTreeList>([]);


  const fetchTree = async () => {
    try {
      setTreeLoading(true);
      const result = await getDeptTree();
      setTreeData(result.data || []);
    } catch {
      setTreeData([]);
    } finally {
      setTreeLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: API.createDeptReq = {
        name: values.name,
        parentId: values.parentId === 0 ? undefined : values.parentId,
        status: values.status,
        sort_order: Number(values.sort_order ?? 0),
        description: values.description,
        leaderId: values.leaderId ? Number(values.leaderId) : undefined,
      };
      await onSubmit(payload);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      fetchTree();
      if (initialValues) {
        form.setFieldsValue({
          parentId: initialValues.parentId ?? 0,
          name: initialValues.name,
          status: initialValues.status ?? 1,
          sort_order: initialValues.sort_order ?? 0,
          description: initialValues.description,
          leaderId: initialValues.leaderId,
        });
      } else {
        form.resetFields();
        // 新增时先不设置 parentId，待树数据加载完成后再默认选中顶级部门，避免短暂显示为数值“0”
        form.setFieldsValue({ status: 1, sort_order: 0 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 树数据到达后，如果是新增模式，默认选择“顶级部门”（id=0），确保显示为标签而非数值“0”
  useEffect(() => {
    if (open && !initialValues && treeData && treeData.length) {
      const firstApiNodeId = treeData[0]?.id;
      form.setFieldValue('parentId', firstApiNodeId ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={confirmLoading}
      maskClosable={false}
      destroyOnClose={true}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="parentId" label="上级部门" rules={[{ required: true, message: '请选择上级部门' }]}>
          <TreeSelect
            treeData={(treeData || []) as unknown as DataNode[]}
            fieldNames={{ label: 'name', value: 'id', children: 'children' }}
            allowClear
            placeholder="请选择上级部门"
            treeDefaultExpandAll
            disabled={treeLoading}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }, { max: 50, message: '最多50个字符' }]}>
          <Input placeholder="请输入部门名称" />
        </Form.Item>

        <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="sort_order" label="排序" rules={[{ required: true, message: '请输入排序值' }]}>
          <Input type="number" placeholder="请输入排序值" />
        </Form.Item>

        <Form.Item name="description" label="部门描述" rules={[{ max: 200, message: '最多200个字符' }]}>
          <Input.TextArea rows={3} placeholder="请输入部门描述（可选）" />
        </Form.Item>

        <Form.Item name="leaderId" label="负责人ID">
          <Input type="number" placeholder="请输入负责人用户ID（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DepartmentForm;