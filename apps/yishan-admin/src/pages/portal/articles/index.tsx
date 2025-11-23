import { PlusOutlined } from "@ant-design/icons";
import { type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App, Tag } from "antd";
import React, { useRef, useState } from "react";
import { getArticleList, deleteArticle, updateArticle, publishArticle } from "@/services/yishan-admin/portalArticles";
import ArticleForm from "./components/ArticleForm";

const statusEnum = {
  "0": { text: "草稿", status: "Default" },
  "1": { text: "已发布", status: "Success" },
} as const;

const ArticleList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  

  const handlePublishToggle = async (record: API.portalArticle) => {
    if (record.status === "1") {
      const res = await updateArticle({ id: record.id }, { status: "0" });
      if (res.success) message.success(res.message);
      actionRef.current?.reload();
      return;
    }
    const res = await publishArticle({ id: record.id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteArticle({ id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.portalArticle>[] = [
    { title: "ID", dataIndex: "id", search: false },
    { title: "标题", dataIndex: "title" },
    { title: "URL标识", dataIndex: "slug", search: false },
    { title: "置顶", dataIndex: "isPinned", search: false, render: (_, r) => r.isPinned ? <Tag color="gold">置顶</Tag> : <Tag>否</Tag> },
    { title: "状态", dataIndex: "status", valueEnum: statusEnum },
    { title: "发布时间", dataIndex: "publishTime", search: false, valueType: "dateTime" },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime" },
    { title: "更新时间", dataIndex: "updatedAt", search: false, valueType: "dateTime" },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      render: (_, record) => [
        <ArticleForm key="edit" title="编辑文章" trigger={<a>编辑</a>} initialValues={record} onFinish={handleFormSuccess} />,
        <a key="publish" onClick={() => handlePublishToggle(record)}>{record.status === "1" ? "下线" : "发布"}</a>,
        <Popconfirm key="delete" title="确定要删除该文章吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.portalArticle>
      headerTitle="文章列表"
      actionRef={actionRef}
      rowKey="id"
      search={{ labelWidth: 120 }}
      toolBarRender={() => [
        <ArticleForm key="create" title="新建文章" trigger={<Button type="primary"><PlusOutlined /> 新建</Button>} onFinish={handleFormSuccess} />,
      ]}
      request={async (params) => {
        const { current, pageSize, keyword, status } = params as any;
        const result = await getArticleList({ page: current, pageSize, keyword, status });
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

export default ArticleList;
