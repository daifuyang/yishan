import React, { useMemo } from 'react';
import { Form } from 'antd';
import type { FormInstance } from 'antd';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';

export interface PostFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysPost;
  onCancel: () => void;
  onSubmit: (values: API.savePostReq | API.updatePostReq) => Promise<void>;
  confirmLoading: boolean;
}

const PostForm: React.FC<PostFormProps> = ({
  form,
  open,
  title,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const initialVals = useMemo(() => (
    initialValues
      ? {
          name: initialValues.name,
          status: (initialValues.status ?? 1) as 0 | 1,
          sort_order: Number(initialValues.sort_order ?? 0),
          description: initialValues.description,
        }
      : { status: 1 as 0 | 1, sort_order: 0 }
  ), [initialValues]);

  return (
    <ModalForm
      form={form}
      width={520}
      title={title}
      open={open}
      onOpenChange={(o) => { if (!o) onCancel(); }}
      modalProps={{ destroyOnClose: true, maskClosable: false, confirmLoading }}
      autoFocusFirstInput
      grid
      initialValues={initialVals}
      syncToInitialValues
      onFinish={async (values) => {
        const payload: API.savePostReq = {
          name: values.name,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          description: values.description,
        };
        await onSubmit(payload);
        return true;
      }}
    >
      <ProFormText
        name="name"
        label="岗位名称"
        placeholder="请输入岗位名称"
        rules={[{ required: true, message: '请输入岗位名称' }, { max: 50, message: '最多50个字符' }]}
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
        label="岗位描述"
        rules={[{ max: 200, message: '最多200个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入岗位描述（可选）' }}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default PostForm;