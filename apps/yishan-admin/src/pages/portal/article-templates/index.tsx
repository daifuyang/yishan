import { PlusOutlined } from "@ant-design/icons";
import { type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App } from "antd";
import React, { useRef, useState } from "react";
import { getArticleTemplateList, deleteArticleTemplate } from "@/services/yishan-admin/portalArticles";
import TemplateForm from "../templates/components/TemplateForm";
import TemplateSchemaForm from "../templates/components/TemplateSchemaForm";

const ArticleTemplates: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleRemove = async (id: number) => {
    const res = await deleteArticleTemplate({ id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => { actionRef.current?.reload(); };

  const columns: ProColumns<API.portalTemplate>[] = [
    { title: "ID", dataIndex: "id", search: false },
    { title: "模板名称", dataIndex: "name" },
    { title: "状态", dataIndex: "status", valueEnum: { "0": { text: "禁用", status: "Error" }, "1": { text: "启用", status: "Success" } } },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime" },
    { title: "更新时间", dataIndex: "updatedAt", search: false, valueType: "dateTime" },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      render: (_, record) => [
        <TemplateForm key="edit" title="编辑模板" type="article" trigger={<a>编辑</a>} initialValues={record} onFinish={handleFormSuccess} />,
        <TemplateSchemaForm key="schema" title="配置结构" type="article" templateId={record.id} trigger={<a>配置结构</a>} onFinish={handleFormSuccess} />,
        <Popconfirm key="delete" title="确定要删除该模板吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.portalTemplate>
      headerTitle="文章模板"
      actionRef={actionRef}
      rowKey="id"
      search={{ labelWidth: 120 }}
      toolBarRender={() => [
        <TemplateForm key="create" title="新建模板" type="article" trigger={<Button type="primary"><PlusOutlined /> 新建</Button>} onFinish={handleFormSuccess} />,
      ]}
      request={async (params) => {
        const { current, pageSize, keyword, status } = params as any;
        const result = await getArticleTemplateList({ page: current, pageSize, keyword, status });
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

export default ArticleTemplates;
