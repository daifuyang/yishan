import { PlusOutlined } from "@ant-design/icons";
import { type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App } from "antd";
import React, { useRef, useState } from "react";
import { useModel } from "@umijs/max";
import { getCategoryList, deleteCategory, updateCategory } from "@/services/yishan-admin/portalCategories";
import CategoryForm from "./components/CategoryForm";

const CategoryList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleStatusChange = async (record: API.portalCategory) => {
    const newStatus = record.status === "1" ? "0" : "1";
    const res = await updateCategory({ id: record.id }, { status: newStatus as "0" | "1" });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteCategory({ id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.portalCategory>[] = [
    { title: "ID", dataIndex: "id", search: false },
    { title: "分类名称", dataIndex: "name" },
    { title: "URL标识", dataIndex: "slug", search: false },
    { title: "父级分类", dataIndex: "parentName", search: false },
    { title: "排序", dataIndex: "sort_order", search: false },
    {
      title: "状态",
      dataIndex: "status",
      valueEnum: defaultStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = { text: item.label, status: item.value === "1" ? "Success" : "Error" };
        return acc;
      }, {} as Record<string, { text: string; status: string }>),
    },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime" },
    { title: "更新时间", dataIndex: "updatedAt", search: false, valueType: "dateTime" },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      render: (_, record) => [
        <CategoryForm key="edit" title="编辑分类" trigger={<a>编辑</a>} initialValues={record} onFinish={handleFormSuccess} />,
        <a key="status" onClick={() => handleStatusChange(record)}>
          {record.status === "1" ? (defaultStatusDict.find(i => i.value === "0")?.label || "禁用") : (defaultStatusDict.find(i => i.value === "1")?.label || "启用")}
        </a>,
        <Popconfirm key="delete" title="确定要删除该分类吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.portalCategory>
      headerTitle="分类列表"
      actionRef={actionRef}
      rowKey="id"
      search={{ labelWidth: 120 }}
      toolBarRender={() => [
        <CategoryForm key="create" title="新建分类" trigger={<Button type="primary"><PlusOutlined /> 新建</Button>} onFinish={handleFormSuccess} />,
      ]}
      request={async (params) => {
        const { current, pageSize, keyword, status, parentId } = params as any;
        const result = await getCategoryList({ page: current, pageSize, keyword, status, parentId });
        return { data: result.data || [], success: result.success, total: (result as any).pagination?.total || 0 };
      }}
      columns={columns}
      rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
        <Space size={24}>
          <span>
            已选 {selectedRowKeys.length} 项
            <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>取消选择</a>
          </span>
        </Space>
      )}
    />
  );
};

export default CategoryList;

