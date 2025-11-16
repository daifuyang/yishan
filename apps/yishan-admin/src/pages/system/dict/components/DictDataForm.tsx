import React, { useMemo } from 'react';
import type { FormInstance } from 'antd';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';

export interface DictDataFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  typeId: number;
  initialValues?: API.sysDictData;
  onCancel: () => void;
  onSubmit: (values: API.saveDictDataReq | API.updateDictDataReq) => Promise<void>;
  confirmLoading: boolean;
}

const DictDataForm: React.FC<DictDataFormProps> = ({
  form,
  open,
  title,
  typeId,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const initialVals = useMemo(() => (
    initialValues
      ? {
          label: initialValues.label,
          value: initialValues.value,
          status: (initialValues.status ?? 1) as 0 | 1,
          sort_order: Number(initialValues.sort_order ?? 0),
          tag: initialValues.tag,
          remark: initialValues.remark,
          isDefault: !!initialValues.isDefault,
        }
      : { status: 1 as 0 | 1, sort_order: 0, isDefault: false }
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
        const payload: API.saveDictDataReq = {
          typeId,
          label: values.label,
          value: String(values.value ?? ''),
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          tag: values.tag,
          remark: values.remark,
          isDefault: !!values.isDefault,
        };
        await onSubmit(payload);
        return true;
      }}
    >
      <ProFormText
        name="label"
        label="字典标签"
        placeholder="例如：男"
        rules={[{ required: true, message: '请输入字典标签' }, { max: 50, message: '最多50个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormText
        name="value"
        label="字典键值"
        placeholder="例如：0"
        rules={[{ required: true, message: '请输入字典键值' }, { max: 100, message: '最多100个字符' }]}
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

      <ProFormText
        name="tag"
        label="标签样式"
        placeholder="可选，例如：success、error、blue"
        rules={[{ max: 32, message: '最多32个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormSwitch
        name="isDefault"
        label="默认值"
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

export default DictDataForm;