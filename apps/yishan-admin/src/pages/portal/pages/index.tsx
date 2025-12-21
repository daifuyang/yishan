import { PlusOutlined } from "@ant-design/icons";
import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Popconfirm, Space, App } from "antd";
import React, { useRef, useState } from "react";
import { useModel } from "@umijs/max";
import { getPageList, deletePage, updatePage } from "@/services/yishan-admin/portalPages";
import PageForm from "./components/PageForm";

const PageList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleStatusChange = async (record: API.portalPage) => {
    const newStatus = record.status === "1" ? "0" : "1";
    const res = await updatePage({ id: record.id }, { status: newStatus as "0" | "1" });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deletePage({ id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.portalPage>[] = [
    { title: "ID", dataIndex: "id", search: false },
    { title: "页面标题", dataIndex: "title" },
    { title: "页面路径", dataIndex: "path" },
    {
      title: "状态",
      dataIndex: "status",
      valueEnum: defaultStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = { text: item.label, status: item.value === "1" ? "Success" : "Error" };
        return acc;
      }, {} as Record<string, { text: string; status: string }>),
    },
    { title: "发布时间", dataIndex: "publishTime", search: false, valueType: "dateTime" },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime" },
    { title: "更新时间", dataIndex: "updatedAt", search: false, valueType: "dateTime" },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      render: (_, record) => [
        <PageForm key="edit" title="编辑页面" trigger={<a>编辑</a>} initialValues={record} onFinish={handleFormSuccess} />,
        <a key="status" onClick={() => handleStatusChange(record)}>
          {record.status === "1" ? (defaultStatusDict.find(i => i.value === "0")?.label || "禁用") : (defaultStatusDict.find(i => i.value === "1")?.label || "启用")}
        </a>,
        <Popconfirm key="delete" title="确定要删除该页面吗？" onConfirm={() => handleRemove(record.id)}>
          <Button className="p-0" type="link" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.portalPage>
        headerTitle="页面列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <PageForm key="create" title="新建页面" trigger={<Button type="primary"><PlusOutlined /> 新建</Button>} onFinish={handleFormSuccess} />,
        ]}
        request={async (params) => {
          const { current, pageSize, keyword, status } = params as any;
          const result = await getPageList({ page: current, pageSize, keyword, status });
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
    </PageContainer>
  );
};

export default PageList;
