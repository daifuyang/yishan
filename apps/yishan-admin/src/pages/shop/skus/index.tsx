import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App, Tag } from "antd";
import React, { useRef } from "react";
import { getSkuList, deleteSku } from "@/services/yishan-admin/shop";
import SkuForm from "./components/SkuForm";

interface SkuAttribute {
  attributeId: number;
  attributeName: string;
  valueId: number;
  valueName: string;
  image?: string;
}

interface ShopSku {
  id: number;
  skuCode: string;
  skuName: string;
  productName?: string;
  price: string | number;
  costPrice?: string | number | null;
  stock: number;
  status: string | number;
  weight?: string | number | null;
  attributes?: SkuAttribute[];
}

const statusEnum = {
  "0": { text: "已下架", status: "Default" },
  "1": { text: "上架中", status: "Success" },
} as const;

const SkuList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();

  const handleRemove = async (id: number) => {
    const res = await deleteSku({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<ShopSku>[] = [
    { title: "ID", dataIndex: "id", search: false, width: 80, responsive: ["md"] },
    { title: "SKU编码", dataIndex: "skuCode", ellipsis: true, width: 180 },
    { title: "SKU名称", dataIndex: "skuName", ellipsis: true, width: 180, responsive: ["md"] },
    { title: "所属商品", dataIndex: "productName", search: false, width: 150, responsive: ["lg"] },
    {
      title: "价格",
      dataIndex: "price",
      search: false,
      width: 100,
      render: (_, record) => `¥${record.price}`,
    },
    { title: "成本价", dataIndex: "costPrice", search: false, width: 100, responsive: ["md"], render: (_, r) => r.costPrice ? `¥${r.costPrice}` : '-' },
    { title: "库存", dataIndex: "stock", search: false, width: 80, responsive: ["md"] },
    { title: "状态", dataIndex: "status", valueEnum: statusEnum, width: 100 },
    {
      title: "属性",
      dataIndex: "attributes",
      search: false,
      width: 200,
      responsive: ["lg"],
      render: (_, record) => (
        <Space size={4} wrap>
          {record.attributes?.map((attr) => (
            <Tag key={`${attr.attributeId}-${attr.valueId}`}>{attr.attributeName}: {attr.valueName}</Tag>
          ))}
        </Space>
      ),
    },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180, responsive: ["lg"] },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      fixed: "right",
      width: 126,
      render: (_, record) => [
        <SkuForm
          key="edit"
          title="编辑SKU"
          trigger={<a>编辑</a>}
          initialValues={{
            ...record,
            price: Number(record.price),
            costPrice: record.costPrice === null || record.costPrice === undefined ? undefined : Number(record.costPrice),
            status: Number(record.status),
            weight: record.weight === null || record.weight === undefined ? undefined : Number(record.weight),
          }}
          onFinish={handleFormSuccess}
        />,
        <Popconfirm key="delete" title="确定要删除该SKU吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<ShopSku>
        headerTitle="SKU列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <SkuForm
            key="create"
            title="新建SKU"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, keyword, productId, status } = params as any;
          const result = await getSkuList({ page: current, pageSize, keyword, productId, status });
          return {
            data: result.data || [],
            success: result.success,
            total: (result as any).pagination?.total || 0,
          };
        }}
        columns={columns}
      />
    </PageContainer>
  );
};

export default SkuList;
