import React, { useEffect, useMemo, useState } from 'react';
import type { FormInstance } from 'antd';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea, ProFormTreeSelect } from '@ant-design/pro-components';
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

  useEffect(() => {
    if (open) {
      fetchTree();
    }
  }, [open]);

  useEffect(() => {
    if (open && !initialValues && treeData && treeData.length) {
      const firstApiNodeId = treeData[0]?.id;
      form.setFieldValue('parentId', firstApiNodeId ?? 0);
    }
  }, [treeData, open, initialValues, form]);

  const initialVals = useMemo(() => (
    initialValues
      ? {
          parentId: initialValues.parentId ?? 0,
          name: initialValues.name,
          status: (initialValues.status ?? 1) as 0 | 1,
          sort_order: Number(initialValues.sort_order ?? 0),
          description: initialValues.description,
          leaderId: initialValues.leaderId,
        }
      : { status: 1 as 0 | 1, sort_order: 0 }
  ), [initialValues]);

  return (
    <ModalForm
      form={form}
      title={title}
      open={open}
      onOpenChange={(o) => { if (!o) onCancel(); }}
      modalProps={{ destroyOnClose: true, maskClosable: false, confirmLoading }}
      autoFocusFirstInput
      grid
      initialValues={initialVals}
      syncToInitialValues
      onFinish={async (values) => {
        const payload: API.createDeptReq = {
          name: values.name,
          parentId: values.parentId === 0 ? undefined : values.parentId,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          description: values.description,
          leaderId: values.leaderId ? Number(values.leaderId) : undefined,
        };
        await onSubmit(payload);
        return true;
      }}
    >
      <ProFormTreeSelect
        name="parentId"
        label="上级部门"
        rules={[{ required: true, message: '请选择上级部门' }]}
        colProps={{ span: 24 }}
        fieldProps={{
          treeData: (treeData || []) as unknown as DataNode[],
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          allowClear: true,
          treeDefaultExpandAll: true,
          disabled: treeLoading,
          style: { width: '100%' },
          showSearch: true,
        }}
      />

      <ProFormText
        name="name"
        label="部门名称"
        placeholder="请输入部门名称"
        rules={[{ required: true, message: '请输入部门名称' }, { max: 50, message: '最多50个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        rules={[{ required: true, message: '请选择状态' }]}
        options={[{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="sort_order"
        label="排序"
        placeholder="请输入排序值"
        rules={[{ required: true, message: '请输入排序值' }]}
        fieldProps={{ min: 0 }}
        colProps={{ span: 24 }}
      />

      <ProFormTextArea
        name="description"
        label="部门描述"
        rules={[{ max: 200, message: '最多200个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入部门描述（可选）' }}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="leaderId"
        label="负责人ID"
        placeholder="请输入负责人用户ID（可选）"
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default DepartmentForm;