import React, { useRef } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormDigit,
  ProFormRadio,
} from "@ant-design/pro-components";
import { getAttributeDetail, createAttribute, updateAttribute } from "@/services/yishan-admin/shop";

interface ShopAttribute {
  id?: number;
  name: string;
  type?: number;
  sortOrder?: number;
  status?: number | string;
  values?: Array<{ id?: number; value: string; image?: string; sortOrder?: number }>;
}

export interface AttributeFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<ShopAttribute>;
  onFinish?: () => Promise<void>;
}

const AttributeForm: React.FC<AttributeFormProps> = ({
  title,
  trigger,
  initialValues = { type: 1, status: 1 },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);

  const fetchDetail = async (id: number) => {
    const res = await getAttributeDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue({
        ...res.data,
      });
    }
  };

  const handleFinish = async (values: any) => {
    const payload: any = {
      name: values.name,
      type: values.type ?? 1,
      sortOrder: values.sortOrder ?? 0,
      status: values.status ?? 1,
    };

    if (values.values && values.values.length > 0) {
      payload.values = values.values;
    }

    if (!initialValues?.id) {
      const res = await createAttribute(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const res = await updateAttribute({ id: Number(initialValues.id) }, payload);
    if (res.success) {
      if (onFinish) await onFinish();
      return true;
    }
    return false;
  };

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      width={520}
      grid
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onFinish={handleFinish}
      onOpenChange={(open: boolean) => {
        if (open) {
          if (initialValues?.id) {
            fetchDetail(initialValues.id);
          } else {
            formRef.current?.resetFields();
          }
        }
      }}
    >
      <ProFormText
        name="name"
        label="属性名称"
        placeholder="请输入属性名称"
        rules={[{ required: true, message: "请输入属性名称" }]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="type"
        label="属性类型"
        options={[
          { label: "普通属性", value: 1 },
          { label: "规格属性", value: 2 },
        ]}
        colProps={{ span: 12 }}
      />

      <ProFormDigit
        name="sortOrder"
        label="排序"
        placeholder="请输入排序"
        min={0}
        fieldProps={{ precision: 0 }}
        colProps={{ span: 12 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={[
          { label: "启用", value: 1 },
          { label: "禁用", value: 0 },
        ]}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default AttributeForm;
