import React, { useRef } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormDigit,
  ProFormRadio,
  ProFormTreeSelect,
  ProFormTextArea,
} from "@ant-design/pro-components";
import { getCategoryDetail, createCategory, updateCategory } from "@/services/yishan-admin/shop";

interface ShopCategory {
  id?: number;
  name: string;
  parentId?: number;
  coverImage?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  status?: number | string;
}

export interface CategoryFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<ShopCategory>;
  treeData?: { label: string; value: number; children?: any[] }[];
  onFinish?: () => Promise<void>;
}

const CategoryForm: React.FC<CategoryFormProps> = ({
  title,
  trigger,
  initialValues = { status: 1 },
  treeData = [],
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);

  const fetchDetail = async (id: number) => {
    const res = await getCategoryDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue({
        ...res.data,
        parentId: res.data.parentId || undefined,
      });
    }
  };

  const handleFinish = async (values: any) => {
    const payload: any = {
      name: values.name,
      parentId: values.parentId || null,
      coverImage: values.coverImage,
      icon: values.icon,
      description: values.description,
      sortOrder: values.sortOrder ?? 0,
      status: values.status ?? 1,
    };

    if (!initialValues?.id) {
      const res = await createCategory(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const res = await updateCategory(
      { id: Number(initialValues.id) },
      payload
    );
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
        label="分类名称"
        placeholder="请输入分类名称"
        rules={[{ required: true, message: "请输入分类名称" }]}
        colProps={{ span: 24 }}
      />

      <ProFormTreeSelect
        name="parentId"
        label="父级分类"
        placeholder="请选择父级分类"
        allowClear
        fieldProps={{
          treeData: [{ label: "顶级分类", value: 0, children: treeData as any }],
        }}
        colProps={{ span: 24 }}
      />

      <ProFormText
        name="icon"
        label="图标"
        placeholder="请输入图标"
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

      <ProFormText
        name="coverImage"
        label="封面图"
        placeholder="请输入封面图URL"
        colProps={{ span: 24 }}
      />

      <ProFormTextArea
        name="description"
        label="描述"
        placeholder="请输入描述"
        colProps={{ span: 24 }}
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

export default CategoryForm;
