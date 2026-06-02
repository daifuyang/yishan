import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App, Tag } from "antd";
import React, { useRef, useState } from "react";
import { getProductList, deleteProduct, moveToRecycle, restoreProduct } from "@/services/yishan-admin/shop";
import ProductForm from "./components/ProductForm";

type ShopProduct = API.shopProduct;

const statusEnum = {
  "0": { text: "已下架", status: "Default" },
  "1": { text: "上架中", status: "Success" },
} as const;

const ProductList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [isRecycle, setIsRecycle] = useState(false);

  const handleDelete = async (id: number) => {
    const res = await deleteProduct({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleRecycle = async (id: number) => {
    const res = await moveToRecycle({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleRestore = async (id: number) => {
    const res = await restoreProduct({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<ShopProduct>[] = [
    { title: "ID", dataIndex: "id", search: false, width: 80, responsive: ["md"] },
    {
      title: "商品",
      dataIndex: "name",
      ellipsis: true,
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.name}</span>
          {record.subtitle && <span style={{ color: "#999", fontSize: 12 }}>{record.subtitle}</span>}
        </Space>
      ),
    },
    { title: "分类", dataIndex: "categoryName", search: false, width: 120, responsive: ["md"] },
    {
      title: "价格",
      dataIndex: "price",
      search: false,
      width: 100,
      render: (_, record) => `¥${record.price}`,
    },
    { title: "库存", dataIndex: "stock", search: false, width: 80, responsive: ["md"] },
    { title: "销量", dataIndex: "clickCount", search: false, width: 80, responsive: ["lg"] },
    {
      title: "标签",
      dataIndex: "isHot",
      search: false,
      width: 120,
      responsive: ["md"],
      render: (_, record) => (
        <Space size={4}>
          {record.isHot && <Tag color="red">热卖</Tag>}
          {record.isNew && <Tag color="blue">新品</Tag>}
        </Space>
      ),
    },
    { title: "状态", dataIndex: "status", valueEnum: statusEnum, width: 100 },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180, responsive: ["lg"] },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      fixed: "right",
      width: 126,
      render: (_, record) => isRecycle ? [
        <Button key="restore" type="link" onClick={() => handleRestore(record.id)}>恢复</Button>,
        <Popconfirm key="delete" title="确定要删除该商品吗？" onConfirm={() => handleDelete(record.id)}>
          <Button className="p-0" type="link" danger>删除</Button>
        </Popconfirm>,
      ] : [
        <ProductForm
          key="edit"
          title="编辑商品"
          trigger={<a>编辑</a>}
          initialValues={{
            id: record.id,
            categoryId: record.categoryId,
            name: record.name,
            subtitle: record.subtitle ?? undefined,
            coverImage: record.coverImage ?? undefined,
            images: record.images,
            description: record.description ?? undefined,
            price: record.price,
            costPrice: record.costPrice ?? undefined,
            stock: record.stock,
            unit: record.unit,
            weight: record.weight ?? undefined,
            status: Number(record.status),
            isHot: record.isHot,
            isNew: record.isNew,
            sortOrder: record.sortOrder,
          }}
          onFinish={handleFormSuccess}
        />,
        <Button key="recycle" type="link" onClick={() => handleRecycle(record.id)}>回收站</Button>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<ShopProduct>
        headerTitle={isRecycle ? "商品回收站" : "商品列表"}
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Button
            key="toggle"
            onClick={() => { setIsRecycle(!isRecycle); actionRef.current?.reload(); }}
          >
            {isRecycle ? "返回商品列表" : "回收站"}
          </Button>,
          !isRecycle && (
            <ProductForm
              key="create"
              title="新建商品"
              trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
              onFinish={handleFormSuccess}
            />
          ),
        ].filter(Boolean)}
        request={async (params) => {
          const { current, pageSize, keyword, categoryId, status, isHot, isNew } = params as any;
          const result = await getProductList({
            page: current,
            pageSize,
            keyword,
            categoryId,
            status,
            isHot,
            isNew,
            isRecycle,
          });
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

export default ProductList;
