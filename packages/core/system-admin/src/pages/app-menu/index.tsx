import type {} from '../../types/index';
import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import {
  deleteAppMenu,
  getAppMenuTree,
  reorderAppMenus,
  updateAppMenu,
} from '../../services/generated/sysAppMenus';
import AppMenuForm from './components/AppMenuForm';

const AppMenuList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [tree, setTree] = useState<SystemAPI.appMenuNode[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const reload = async () => {
    actionRef.current?.reload();
  };

  const siblingsOf = (record: SystemAPI.appMenuNode) =>
    record.parentId == null
      ? tree
      : tree.find((group) => group.id === record.parentId)?.children || [];

  const handleMove = async (
    record: SystemAPI.appMenuNode,
    direction: -1 | 1,
  ) => {
    const siblings = siblingsOf(record);
    const index = siblings.findIndex((item) => item.id === record.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const ordered = siblings.map((item) => item.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const res = await reorderAppMenus({
      parentId: record.parentId,
      orderedIds: ordered,
    });
    if (res.success) await reload();
  };

  const handleToggleStatus = async (record: SystemAPI.appMenuNode) => {
    const res = await updateAppMenu(
      { id: String(record.id) },
      { status: record.status === '1' ? '0' : '1' },
    );
    if (res.success) {
      message.success(res.message);
      await reload();
    }
  };

  const handleRemove = async (id: number) => {
    const res = await deleteAppMenu({ id: String(id) });
    if (res.success) {
      message.success(res.message);
      await reload();
    }
  };

  const columns: ProColumns<SystemAPI.appMenuNode>[] = [
    { title: '名称', dataIndex: 'name', width: 200 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (_, record) =>
        record.type === 0 ? (
          <Tag>分组</Tag>
        ) : (
          <Tag color="blue">应用入口</Tag>
        ),
    },
    { title: '图标', dataIndex: 'icon', width: 120, renderText: (v) => v || '—' },
    {
      title: 'App 页面',
      dataIndex: 'page',
      width: 280,
      renderText: (v) => v || '—',
    },
    { title: '所属模块', dataIndex: 'moduleId', width: 110 },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueEnum: {
        '1': { text: '启用', status: 'Success' },
        '0': { text: '禁用', status: 'Error' },
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size={16}>
          <AppMenuForm
            title="编辑工作台菜单"
            trigger={<a>编辑</a>}
            initialValues={record}
            groups={tree}
            onFinish={reload}
          />
          {record.type === 0 && (
            <AppMenuForm
              title="新建应用入口"
              trigger={<a>添加入口</a>}
              initialValues={{ parentId: record.id }}
              groups={tree}
              onFinish={reload}
            />
          )}
          <a onClick={() => handleMove(record, -1)}>上移</a>
          <a onClick={() => handleMove(record, 1)}>下移</a>
          <a onClick={() => handleToggleStatus(record)}>
            {record.status === '1' ? '禁用' : '启用'}
          </a>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleRemove(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<SystemAPI.appMenuNode>
        headerTitle="工作台管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        pagination={false}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
        }}
        toolBarRender={() => [
          <AppMenuForm
            key="create"
            title="新建工作台菜单"
            trigger={
              <Button type="primary">
                <PlusOutlined /> 新建
              </Button>
            }
            groups={tree}
            onFinish={reload}
          />,
        ]}
        request={async () => {
          const result = await getAppMenuTree();
          const data = result.data || [];
          setTree(data);
          setExpandedRowKeys(data.map((group) => group.id));
          return { data, success: result.success };
        }}
        columns={columns}
        scroll={{ x: 1300 }}
      />
    </PageContainer>
  );
};

export default AppMenuList;
