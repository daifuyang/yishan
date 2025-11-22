import React, { useMemo, useRef } from 'react';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea, type ProFormInstance } from '@ant-design/pro-components';
import { getDictTypeDetail, createDictType, updateDictType } from '@/services/yishan-admin/sysDictTypes';

export interface DictTypeFormProps {
  title: string;
  trigger: React.ReactNode;
  initialValues?: Partial<API.sysDictType>;
  onFinish?: () => Promise<void>;
}

const DictTypeForm: React.FC<DictTypeFormProps> = ({
  title,
  trigger,
  initialValues,
  onFinish,
}) => {
  const formRef = useRef<ProFormInstance>(null);
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
      formRef={formRef}
      width={520}
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      grid
      initialValues={initialVals}
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          getDictTypeDetail({ id: Number(initialValues.id) }).then((res) => {
            if (res.success && res.data) {
              formRef.current?.setFieldsValue(res.data as any);
            }
          });
        }
      }}
      onFinish={async (values) => {
        const payload = {
          name: values.name,
          type: values.type,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          remark: values.remark,
        } as API.saveDictTypeReq;
        if (!initialValues?.id) {
          const res = await createDictType(payload);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }
        const res = await updateDictType({ id: Number(initialValues.id) }, payload as API.updateDictTypeReq);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
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
