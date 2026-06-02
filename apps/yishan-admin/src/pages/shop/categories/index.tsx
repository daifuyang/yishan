import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App } from "antd";
import React, { useRef, useState, useEffect } from "react";
import { getCategoryList, getCategoryTree, deleteCategory } from "@/services/yishan-admin/shop";
import CategoryForm from "./components/CategoryForm";

interface ShopCategory {
  id: number;
  name: string;
  parentId?: number;
  coverImage?: string;
  icon?: string;
  description?: string;
  sortOrder: number;
  status: string;
  children?: ShopCategory[];
}

const statusEnum = {
  "0": { text: "禁用", status: "Default" },
  "1": { text: "启用", status: "Success" },
} as const;

const CategoryList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [treeData, setTreeData] = useState<{ label: string; value: number; children?: any[] }[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    const res = await getCategoryTree();
    if (res.success && res.data) {
      const formatTree = (categories: ShopCategory[]): any[] => {
        return categories.map((cat) => ({
          label: cat.name,
          value: cat.id,
          children: cat.children && cat.children.length > 0 ? formatTree(cat.children) : undefined,
        }));
      };
      setTreeData(formatTree(res.data));
    }
  };

  const handleRemove = async (id: number) => {
    const res = await deleteCategory({ id });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
      loadTree();
    }
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
    loadTree();
  };

  const columns: ProColumns<ShopCategory>[] = [
    { title: "ID", dataIndex: "id", search: false, width: 80, responsive: ["md"] },
    { title: "分类名称", dataIndex: "name", ellipsis: true },
    {
      title: "父级分类",
      dataIndex: "parentId",
      search: false,
      responsive: ["md"],
      render: (_, record) => record.parentId ? treeData.find(t => t.value === record.parentId)?.label || '-' : '-',
    },
    { title: "排序", dataIndex: "sortOrder", search: false, width: 80, responsive: ["md"] },
    { title: "状态", dataIndex: "status", valueEnum: statusEnum, width: 100 },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180, responsive: ["lg"] },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      fixed: "right",
      width: 126,
      render: (_, record) => [
        <CategoryForm
          key="edit"
          title="编辑分类"
          trigger={<a>编辑</a>}
          initialValues={record}
          treeData={treeData}
          onFinish={handleFormSuccess}
        />,
        <Popconfirm key="delete" title="确定要删除该分类吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<ShopCategory>
        headerTitle="商品分类列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CategoryForm
            key="create"
            title="新建分类"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            treeData={treeData}
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, keyword, status } = params as any;
          const result = await getCategoryList({ page: current, pageSize, keyword, status });
          return {
            data: result.data || [],
            success: result.success,
            total: (result as any).pagination?.total || 0,
          };
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
    </PageContainer>
  );
};

export default CategoryList;
