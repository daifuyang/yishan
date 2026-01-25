import { PlusOutlined, AppstoreOutlined, BarsOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { PageContainer, type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag, Segmented, Card, Avatar, Typography, Pagination, Empty } from 'antd';
import React, { useRef, useState } from 'react';
import { history, useModel } from '@umijs/max';
import { getAppList, deleteApp } from '@/services/yishan-admin/sysApps';
import AppForm from './components/AppForm';
import { ICON_MAP } from './constants';

const { Paragraph } = Typography;

const AppList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteApp({ id });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的应用');
      return;
    }
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deleteApp({ id }));
    const results = await Promise.allSettled(deletePromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      message.success(`批量删除完成：成功 ${successCount}，失败 ${failureCount}`);
    } else {
      message.error('批量删除失败');
    }

    actionRef.current?.reload();
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
  };

  const columns: ProColumns<API.sysApp>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 80 },
    { title: '应用名称', dataIndex: 'name' },
    {
      title: '图标',
      dataIndex: 'icon',
      search: false,
      render: (_, record) => {
        const IconComponent = record.icon && ICON_MAP[record.icon] ? ICON_MAP[record.icon] : null;
        return (
          <Space>
            <Avatar
              shape="square"
              style={{ backgroundColor: record.iconColor || '#1890ff' }}
              icon={IconComponent}
            >
              {!IconComponent && (record.name ? record.name.substring(0, 1) : 'A')}
            </Avatar>
            {record.iconColor && <Tag color={record.iconColor}>{record.iconColor}</Tag>}
          </Space>
        );
      }
    },
    { title: '排序', dataIndex: 'sort_order', search: false, width: 80 },
    { title: '应用描述', dataIndex: 'description', search: false, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime', width: 160 },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, valueType: 'dateTime', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: defaultStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = {
          text: item.label,
          status: item.value === '1' ? 'Success' : 'Error',
        };
        return acc;
      }, {} as Record<string, { text: string; status: string }>),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <a key="view" onClick={() => history.push(`/system/apps/${record.id}`)}>
          查看
        </a>,
        <AppForm
          key="edit"
          title="编辑应用"
          trigger={<a>编辑</a>}
          initialValues={record}
          onFinish={handleFormSuccess}
        />,
        <Popconfirm key="delete" title="确定要删除该应用吗？" onConfirm={() => handleRemove(record.id || 0)}>
          <Button className='p-0' type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const renderCardView = (dataSource: API.sysApp[], pagination: any) => {
    if (!dataSource || dataSource.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

    // Grouping by status
    const groups = dataSource.reduce((acc, item) => {
      const status = item.status || '0';
      if (!acc[status]) acc[status] = [];
      acc[status].push(item);
      return acc;
    }, {} as Record<string, API.sysApp[]>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(groups).map(([status, items]) => (
          <div key={status}>
            <Typography.Title level={5} style={{ marginBottom: 16, borderLeft: '4px solid #1890ff', paddingLeft: 8 }}>
              {defaultStatusDict.find(d => d.value === status)?.label || (status === '1' ? '启用' : '禁用')}
            </Typography.Title>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {items.map(item => (
                <Card
                  key={item.id}
                  hoverable
                  style={{ width: 300 }}
                  styles={{
                    body: { padding: 16 },
                  }}
                  actions={[
                    <EyeOutlined key="view" onClick={() => history.push(`/system/apps/${item.id}`)} />,
                    <AppForm
                      key="edit"
                      title="编辑应用"
                      trigger={<EditOutlined key="edit" />}
                      initialValues={item}
                      onFinish={handleFormSuccess}
                    />,
                    <Popconfirm key="delete" title="确定要删除该应用吗？" onConfirm={() => handleRemove(item.id || 0)}>
                      <DeleteOutlined key="delete" />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: item.iconColor || '#1890ff', verticalAlign: 'middle' }}
                        shape="square"
                        size="large"
                        icon={item.icon && ICON_MAP[item.icon] ? ICON_MAP[item.icon] : undefined}
                      >
                        {(!item.icon || !ICON_MAP[item.icon]) && (item.name ? item.name.substring(0, 1) : 'A')}
                      </Avatar>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={item.name}>{item.name}</span>
                        <Tag color={item.status === '1' ? 'success' : 'error'} style={{ marginRight: 0 }}>
                          {defaultStatusDict.find(d => d.value === item.status)?.label || item.status}
                        </Tag>
                      </div>
                    }
                    description={
                      <Paragraph ellipsis={{ rows: 2 }} style={{ height: 44, marginBottom: 0, marginTop: 8 }} type="secondary">
                        {item.description || '暂无描述'}
                      </Paragraph>
                    }
                  />
                </Card>
              ))}
            </div>
          </div>
        ))}
        {pagination && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              {...pagination}
              onChange={(page, pageSize) => {
                pagination.onChange?.(page, pageSize);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <ProTable<API.sysApp>
        headerTitle="应用列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Segmented
            key="viewMode"
            value={viewMode}
            onChange={(value) => setViewMode(value as 'list' | 'card')}
            options={[
              { value: 'card', icon: <AppstoreOutlined />, label: '卡片' },
              { value: 'list', icon: <BarsOutlined />, label: '列表' },
            ]}
          />,
          <AppForm
            key="create"
            title="新建应用"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, name, status } = params;
          const result = await getAppList({
            page: current,
            pageSize,
            status,
            keyword: name as string,
          });
          return {
            data: result.data || [],
            success: result.success,
            total: (result as any).pagination?.total || 0,
          };
        }}
        columns={[
          {
            title: '关键词',
            dataIndex: 'name',
            hideInTable: true,
            fieldProps: { placeholder: '请输入应用名称' }
          },
          ...columns,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
          <Space size={24}>
            <span>
              已选 {selectedRowKeys.length} 项
              <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
                取消选择
              </a>
            </span>
          </Space>
        )}
        tableAlertOptionRender={() => {
          return (
            <Space>
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 个应用吗？`}
                onConfirm={handleBatchRemove}
              >
                <Button type="link" danger loading={batchDeleteLoading}>
                  批量删除
                </Button>
              </Popconfirm>
            </Space>
          );
        }}
        tableRender={(props: any, dom, { toolbar, alert }) => {
          if (viewMode === 'list') return dom;
          return (
            <Card styles={{ body: { padding: '0px 24px' } }}>
              {toolbar}
              {alert}
              {renderCardView(props.action?.dataSource as API.sysApp[], props.action?.pageInfo)}
            </Card>
          );
        }}
      />
    </PageContainer>
  );
};

export default AppList;
