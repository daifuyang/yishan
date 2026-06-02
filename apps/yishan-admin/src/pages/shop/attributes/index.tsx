import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App, Tag } from "antd";
import React, { useRef } from "react";
import { getAttributeList, deleteAttribute } from "@/services/yishan-admin/shop";
import AttributeForm from "./components/AttributeForm";
import AttributeValueModal from "./components/AttributeValueModal";

interface ShopAttributeValue {
  id: number;
  value: string;
  image?: string;
  sortOrder: number;
  status: string;
}

interface ShopAttribute {
  id: number;
  name: string;
  type: number;
  sortOrder: number;
  status: string;
  values?: ShopAttributeValue[];
}

const typeEnum = {
  1: { text: "普通属性", status: "Default" },
  2: { text: "规格属性", status: "Processing" },
} as const;

const statusEnum = {
  "0": { text: "禁用", status: "Default" },
  "1": { text: "启用", status: "Success" },
} as const;

const AttributeList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();

  const handleRemove = async (id: number) => {
    const res = await deleteAttribute({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<ShopAttribute>[] = [
    { title: "ID", dataIndex: "id", search: false, width: 80, responsive: ["md"] },
    { title: "属性名称", dataIndex: "name", ellipsis: true, width: 180 },
    { title: "类型", dataIndex: "type", valueEnum: typeEnum, width: 120, responsive: ["md"] },
    { title: "排序", dataIndex: "sortOrder", search: false, width: 80, responsive: ["md"] },
    { title: "状态", dataIndex: "status", valueEnum: statusEnum, width: 100 },
    {
      title: "属性值",
      dataIndex: "values",
      search: false,
      responsive: ["md"],
      render: (_, record) => (
        <Space size={4} wrap>
          {record.values?.slice(0, 3).map((v) => (
            <Tag key={v.id}>{v.value}</Tag>
          ))}
          {record.values && record.values.length > 3 && (
            <Tag>+{record.values.length - 3} more</Tag>
          )}
        </Space>
      ),
    },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180, responsive: ["lg"] },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      fixed: "right",
      width: 156,
      render: (_, record) => [
        <AttributeValueModal
          key="values"
          attributeId={record.id}
          attributeName={record.name}
          trigger={<a>管理值</a>}
        />,
        <AttributeForm
          key="edit"
          title="编辑属性"
          trigger={<a>编辑</a>}
          initialValues={record}
          onFinish={handleFormSuccess}
        />,
        <Popconfirm key="delete" title="确定要删除该属性吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<ShopAttribute>
        headerTitle="商品属性列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <AttributeForm
            key="create"
            title="新建属性"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, keyword, type, status } = params as any;
          const result = await getAttributeList({ page: current, pageSize, keyword, type, status });
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

export default AttributeList;
