import React, { useMemo } from 'react';
import type { FormInstance } from 'antd';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';

export interface DictTypeFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysDictType;
  onCancel: () => void;
  onSubmit: (values: API.saveDictTypeReq | API.updateDictTypeReq) => Promise<void>;
  confirmLoading: boolean;
}

const DictTypeForm: React.FC<DictTypeFormProps> = ({
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
          type: initialValues.type,
          status: (initialValues.status ?? 1) as 0 | 1,
          sort_order: Number(initialValues.sort_order ?? 0),
          remark: initialValues.remark,
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
        const payload: API.saveDictTypeReq = {
          name: values.name,
          type: values.type,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          remark: values.remark,
        };
        await onSubmit(payload);
        return true;
      }}
    >
      <ProFormText
        name="name"
        label="字典名称"
        placeholder="请输入字典名称"
        rules={[{ required: true, message: '请输入字典名称' }, { max: 50, message: '最多50个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormText
        name="type"
        label="字典类型"
        placeholder="例如：sys_user_sex"
        rules={[{ required: true, message: '请输入字典类型' }, { max: 100, message: '最多100个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        rules={[{ required: true, message: '请选择状态' }]}
        options={[{ label: '正常', value: 1 }, { label: '停用', value: 0 }]}
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
        name="remark"
        label="备注"
        rules={[{ max: 200, message: '最多200个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入备注（可选）' }}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default DictTypeForm;