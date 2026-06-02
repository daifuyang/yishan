import React, { useRef, useEffect, useState } from "react";
import {
  DrawerForm,
  ProFormText,
  ProFormDigit,
  ProFormRadio,
  ProFormSwitch,
  ProFormTextArea,
  ProFormSelect,
  EditableProTable,
  ProFormGroup,
} from "@ant-design/pro-components";
import { Form } from "antd";
import { getCategoryTree } from "@/services/yishan-admin/shop";
import { getProductDetail, createProduct, updateProduct } from "@/services/yishan-admin/shop";

interface SkuAttribute {
  attributeId: number;
  valueId: number;
}

interface ShopSku {
  id?: number;
  skuCode: string;
  skuName: string;
  price: number | string;
  costPrice?: number | string;
  stock?: number;
  weight?: number;
  coverImage?: string;
  attributes?: SkuAttribute[];
}

interface ShopProduct {
  id?: number;
  categoryId: number;
  name: string;
  subtitle?: string;
  coverImage?: string;
  images?: string[];
  description?: string;
  price: number | string;
  costPrice?: number | string;
  stock?: number;
  unit?: string;
  weight?: number | string;
  status?: number | string;
  isHot?: boolean;
  isNew?: boolean;
  sortOrder?: number;
  skus?: ShopSku[];
}

export interface ProductFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<ShopProduct>;
  onFinish?: () => Promise<void>;
}

const ProductForm: React.FC<ProductFormProps> = ({
  title,
  trigger,
  initialValues = { status: 1, isHot: false, isNew: false },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const res = await getCategoryTree();
    if (res.success && res.data) {
      const formatOptions = (categories: any[], prefix = ""): { label: string; value: number }[] => {
        const result: { label: string; value: number }[] = [];
        for (const cat of categories) {
          result.push({ label: prefix + cat.name, value: cat.id });
          if (cat.children && cat.children.length > 0) {
            result.push(...formatOptions(cat.children, `${prefix}  ├── `));
          }
        }
        return result;
      };
      setCategoryOptions(formatOptions(res.data));
    }
  };

  const fetchDetail = async (id: number) => {
    const res = await getProductDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue({
        ...res.data,
        skus: res.data.skus?.map((sku: any) => ({
          ...sku,
          key: sku.id,
        })) || [],
      });
    }
  };

  const handleFinish = async (values: any) => {
    const payload: any = {
      categoryId: values.categoryId,
      name: values.name,
      subtitle: values.subtitle,
      coverImage: values.coverImage,
      images: values.images,
      description: values.description,
      price: values.price,
      costPrice: values.costPrice,
      stock: values.stock ?? 0,
      unit: values.unit ?? "件",
      weight: values.weight,
      status: values.status ?? 1,
      isHot: values.isHot ?? false,
      isNew: values.isNew ?? false,
      sortOrder: values.sortOrder ?? 0,
    };

    if (values.skus && values.skus.length > 0) {
      payload.skus = values.skus.map((sku: any) => ({
        skuCode: sku.skuCode,
        skuName: sku.skuName,
        price: sku.price,
        costPrice: sku.costPrice,
        stock: sku.stock ?? 0,
        weight: sku.weight,
        coverImage: sku.coverImage,
        attributes: sku.attributes,
      }));
    }

    if (!initialValues?.id) {
      const res = await createProduct(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const res = await updateProduct({ id: Number(initialValues.id) }, payload);
    if (res.success) {
      if (onFinish) await onFinish();
      return true;
    }
    return false;
  };

  const skuColumns = [
    { title: "SKU编码", dataIndex: "skuCode", width: 120, formItemProps: { rules: [{ required: true, message: "请输入SKU编码" }] } },
    { title: "SKU名称", dataIndex: "skuName", width: 150, formItemProps: { rules: [{ required: true, message: "请输入SKU名称" }] } },
    { title: "价格", dataIndex: "price", valueType: "money", width: 100, formItemProps: { rules: [{ required: true, message: "请输入价格" }] } },
    { title: "成本价", dataIndex: "costPrice", valueType: "money", width: 100 },
    { title: "库存", dataIndex: "stock", valueType: "digit", width: 80 },
    { title: "重量", dataIndex: "weight", valueType: "digit", width: 80 },
    { title: "操作", valueType: "option", width: 80 },
  ];

  return (
    <DrawerForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      width={900}
      formRef={formRef}
      initialValues={initialValues}
      drawerProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(open: boolean) => {
        if (open) {
          if (initialValues?.id) {
            fetchDetail(initialValues.id);
          } else {
            formRef.current?.resetFields();
          }
        }
      }}
      onFinish={handleFinish}
    >
      <ProFormGroup title="基本信息">
        <ProFormSelect
          name="categoryId"
          label="商品分类"
          placeholder="请选择商品分类"
          options={categoryOptions}
          rules={[{ required: true, message: "请选择商品分类" }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label="商品名称"
          placeholder="请输入商品名称"
          rules={[{ required: true, message: "请输入商品名称" }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="subtitle"
          label="副标题"
          placeholder="请输入副标题"
          colProps={{ span: 24 }}
        />
        <ProFormDigit
          name="price"
          label="商品价格"
          placeholder="请输入商品价格"
          min={0}
          fieldProps={{ precision: 2 }}
          colProps={{ span: 8 }}
        />
        <ProFormDigit
          name="costPrice"
          label="成本价"
          placeholder="请输入成本价"
          min={0}
          fieldProps={{ precision: 2 }}
          colProps={{ span: 8 }}
        />
        <ProFormDigit
          name="stock"
          label="库存"
          placeholder="请输入库存"
          min={0}
          fieldProps={{ precision: 0 }}
          colProps={{ span: 8 }}
        />
        <ProFormText name="unit" label="单位" placeholder="如：件、个" colProps={{ span: 8 }} />
        <ProFormDigit name="weight" label="重量(g)" placeholder="请输入重量" min={0} colProps={{ span: 8 }} />
        <ProFormDigit name="sortOrder" label="排序" placeholder="请输入排序" min={0} colProps={{ span: 8 }} />
      </ProFormGroup>

      <ProFormGroup title="商品状态">
        <ProFormRadio.Group
          name="status"
          label="上架状态"
          options={[
            { label: "上架中", value: 1 },
            { label: "已下架", value: 0 },
          ]}
          colProps={{ span: 12 }}
        />
        <Form.Item name="isHot" label="热卖" valuePropName="checked">
          <ProFormSwitch />
        </Form.Item>
        <Form.Item name="isNew" label="新品" valuePropName="checked">
          <ProFormSwitch />
        </Form.Item>
      </ProFormGroup>

      <ProFormGroup title="商品图片">
        <ProFormText
          name="coverImage"
          label="封面图"
          placeholder="请输入封面图URL"
          colProps={{ span: 24 }}
        />
      </ProFormGroup>

      <ProFormGroup title="商品描述">
        <ProFormTextArea
          name="description"
          label="商品描述"
          placeholder="请输入商品描述"
          colProps={{ span: 24 }}
          fieldProps={{ rows: 4 }}
        />
      </ProFormGroup>

      <ProFormGroup title="SKU管理">
        <Form.Item name="skus" style={{ width: "100%" }}>
          <EditableProTable
            recordCreatorProps={{
              newRecordType: "dataSource",
              record: () => ({
                key: Date.now(),
                skuCode: "",
                skuName: "",
                price: 0,
                costPrice: 0,
                stock: 0,
                weight: 0,
              } as any),
            }}
            editable={{
              type: "multiple",
              editableKeys,
              onChange: setEditableRowKeys,
            }}
            columns={skuColumns as any}
            rowKey="key"
          />
        </Form.Item>
      </ProFormGroup>
    </DrawerForm>
  );
};

export default ProductForm;
