import React, { useRef, useEffect, useState } from "react";
import {
  DrawerForm,
  ProFormText,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  EditableProTable,
  ProFormGroup,
} from "@ant-design/pro-components";
import { Form } from "antd";
import { getSkuDetail, createSku, updateSku } from "@/services/yishan-admin/shop";
import { getProductList } from "@/services/yishan-admin/shop";
import { getSpecAttributes } from "@/services/yishan-admin/shop";

interface SkuAttribute {
  attributeId: number;
  attributeName: string;
  valueId: number;
  valueName: string;
  image?: string;
}

interface ShopSku {
  id?: number;
  productId: number;
  skuCode: string;
  skuName: string;
  price: number;
  costPrice?: number;
  stock?: number;
  weight?: number;
  coverImage?: string;
  status?: number;
  attributes?: SkuAttribute[];
}

interface ShopProduct {
  id: number;
  name: string;
  categoryId: number;
}

export interface SkuFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<ShopSku>;
  onFinish?: () => Promise<void>;
}

const SkuForm: React.FC<SkuFormProps> = ({
  title,
  trigger,
  initialValues = { status: 1 },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([]);
  const [productOptions, setProductOptions] = useState<{ label: string; value: number }[]>([]);
  const [specOptions, setSpecOptions] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
    loadSpecs();
  }, []);

  const loadProducts = async () => {
    const res = await getProductList({ page: 1, pageSize: 100, status: "1" });
    if (res.success && res.data) {
      setProductOptions(res.data.map((p: ShopProduct) => ({ label: p.name, value: p.id })));
    }
  };

  const loadSpecs = async () => {
    const res = await getSpecAttributes();
    if (res.success && res.data) {
      const options: any[] = [];
      for (const spec of res.data) {
        for (const val of spec.values || []) {
          options.push({
            label: `${spec.name}: ${val.value}`,
            value: JSON.stringify({ attributeId: spec.id, valueId: val.id }),
          });
        }
      }
      setSpecOptions(options);
    }
  };

  const fetchDetail = async (id: number) => {
    const res = await getSkuDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue({
        ...res.data,
        attributes: res.data.attributes?.map((attr: any, idx: number) => ({
          key: idx,
          attributeId: attr.attributeId,
          valueId: attr.valueId,
        })) || [],
      });
    }
  };

  const handleFinish = async (values: any) => {
    const payload: any = {
      productId: values.productId,
      skuCode: values.skuCode,
      skuName: values.skuName,
      price: values.price,
      costPrice: values.costPrice,
      stock: values.stock ?? 0,
      weight: values.weight,
      coverImage: values.coverImage,
      status: values.status ?? 1,
    };

    if (values.attributes && values.attributes.length > 0) {
      payload.attributes = values.attributes.map((attr: any) => {
        if (typeof attr.valueId === "string") {
          return JSON.parse(attr.valueId);
        }
        return { attributeId: attr.attributeId, valueId: attr.valueId };
      });
    }

    if (!initialValues?.id) {
      const res = await createSku(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const res = await updateSku({ id: Number(initialValues.id) }, payload);
    if (res.success) {
      if (onFinish) await onFinish();
      return true;
    }
    return false;
  };

  const attributeColumns = [
    {
      title: "规格属性",
      dataIndex: "valueId",
      valueType: "select",
      formItemProps: {
        rules: [{ required: true, message: "请选择规格属性" }],
      },
      fieldProps: {
        options: specOptions,
      },
    },
    { title: "操作", valueType: "option", width: 80 },
  ];

  return (
    <DrawerForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      width={600}
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
      <ProFormSelect
        name="productId"
        label="所属商品"
        placeholder="请选择所属商品"
        options={productOptions}
        rules={[{ required: true, message: "请选择所属商品" }]}
        colProps={{ span: 24 }}
      />

      <ProFormText
        name="skuCode"
        label="SKU编码"
        placeholder="请输入SKU编码"
        rules={[{ required: true, message: "请输入SKU编码" }]}
        colProps={{ span: 12 }}
      />

      <ProFormText
        name="skuName"
        label="SKU名称"
        placeholder="请输入SKU名称"
        rules={[{ required: true, message: "请输入SKU名称" }]}
        colProps={{ span: 12 }}
      />

      <ProFormDigit
        name="price"
        label="价格"
        placeholder="请输入价格"
        min={0}
        fieldProps={{ precision: 2 }}
        rules={[{ required: true, message: "请输入价格" }]}
        colProps={{ span: 12 }}
      />

      <ProFormDigit
        name="costPrice"
        label="成本价"
        placeholder="请输入成本价"
        min={0}
        fieldProps={{ precision: 2 }}
        colProps={{ span: 12 }}
      />

      <ProFormDigit
        name="stock"
        label="库存"
        placeholder="请输入库存"
        min={0}
        fieldProps={{ precision: 0 }}
        colProps={{ span: 12 }}
      />

      <ProFormDigit
        name="weight"
        label="重量(g)"
        placeholder="请输入重量"
        min={0}
        colProps={{ span: 12 }}
      />

      <ProFormText
        name="coverImage"
        label="SKU图片"
        placeholder="请输入SKU图片URL"
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={[
          { label: "上架中", value: 1 },
          { label: "已下架", value: 0 },
        ]}
        colProps={{ span: 24 }}
      />

      <ProFormGroup title="规格属性">
        <Form.Item name="attributes" style={{ width: "100%" }}>
          <EditableProTable
            recordCreatorProps={{
              newRecordType: "dataSource",
              record: () => ({
                key: Date.now(),
              } as any),
            }}
            editable={{
              type: "multiple",
              editableKeys,
              onChange: setEditableRowKeys,
            }}
            columns={attributeColumns as any}
            rowKey="key"
          />
        </Form.Item>
      </ProFormGroup>
    </DrawerForm>
  );
};

export default SkuForm;
