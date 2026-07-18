import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import {
  deleteMenu,
  getMenuTree,
  updateMenu,
} from '@/services/yishan-admin/sysMenus';
import MenuForm from './components/MenuForm';

const MenuStatus = { ENABLED: '1', DISABLED: '0' } as const;

const MENU_TYPE_META: Record<number, { label: string; color: string }> = {
  0: { label: '目录', color: 'default' },
  1: { label: '页面', color: 'blue' },
  2: { label: '按钮', color: 'purple' },
};

const MenuList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> =
    dictDataMap.default_status || [];

  const handleStatusChange = async (id: number, status: '0' | '1') => {
    const newStatus =
      status === MenuStatus.ENABLED ? MenuStatus.DISABLED : MenuStatus.ENABLED;
    const res = await updateMenu(
      { id: String(id) },
      { status: newStatus as '0' | '1' },
    );
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteMenu({ id: String(id) });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的菜单');
      return;
    }
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deleteMenu({ id: String(id) }));
    const results = await Promise.allSettled(deletePromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      message.success(
        `批量删除完成：成功 ${successCount}，失败 ${failureCount}`,
      );
    } else {
      message.error('批量删除失败');
    }

    actionRef.current?.reload();
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
  };

  const columns: ProColumns<API.menuTreeNode>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 110,
      render: (_, record) => <span style={{ whiteSpace: 'nowrap' }}>{record.id}</span>,
    },
    { title: '菜单名称', dataIndex: 'name', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      search: false,
      width: 90,
      render: (_, record) => {
        const meta = MENU_TYPE_META[record.type] || MENU_TYPE_META[1];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '路由地址',
      dataIndex: 'path',
      search: false,
      width: 210,
      renderText: (value) => value || '—',
    },
    {
      title: '组件',
      dataIndex: 'component',
      search: false,
      width: 180,
      renderText: (value) => value || '—',
    },
    { title: '排序', dataIndex: 'sort_order', search: false, width: 80 },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: defaultStatusDict.reduce(
        (acc: Record<string, { text: string; status: string }>, item) => {
          acc[item.value] = {
            text: item.label,
            status: item.value === '1' ? 'Success' : 'Error',
          };
          return acc;
        },
        {} as Record<string, { text: string; status: string }>,
      ),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <MenuForm
            title="编辑菜单"
            trigger={<a>编辑</a>}
            initialValues={record}
            onFinish={handleFormSuccess}
          />
          <a
            onClick={() =>
              handleStatusChange(record.id || 0, record.status || '0')
            }
          >
            {record.status === MenuStatus.ENABLED
              ? defaultStatusDict.find((item) => item.value === '0')?.label ||
                '禁用'
              : defaultStatusDict.find((item) => item.value === '1')?.label ||
                '启用'}
          </a>
          <Popconfirm
            title="确定要删除该菜单吗？"
            onConfirm={() => handleRemove(record.id || 0)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.menuTreeNode>
        headerTitle="菜单列表"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        pagination={false}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
        }}
        toolBarRender={() => [
          <MenuForm
            key="create"
            title="新建菜单"
            trigger={
              <Button type="primary">
                <PlusOutlined /> 新建
              </Button>
            }
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async () => {
          const result = await getMenuTree();
          const normalize = (
            nodes: API.menuTreeNode[] | null | undefined,
          ): API.menuTreeNode[] => {
            if (!nodes) return [];
            return nodes.map((n) => ({
              ...n,
              children: n.children ? normalize(n.children) : null,
            }));
          };
          const collectIds = (
            nodes: API.menuTreeNode[] | null | undefined,
          ): number[] => {
            if (!nodes) return [];
            const acc: number[] = [];
            const walk = (list: API.menuTreeNode[]) => {
              list.forEach((n) => {
                acc.push(n.id || 0);
                if (Array.isArray(n.children)) {
                  walk(n.children as API.menuTreeNode[]);
                }
              });
            };
            walk(nodes);
            return acc;
          };
          const data = normalize(result.data) || [];
          setExpandedRowKeys(collectIds(data));
          return {
            data,
            success: result.success,
          };
        }}
        columns={columns}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        scroll={{ x: 1280 }}
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
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 个菜单吗？`}
              onConfirm={handleBatchRemove}
            >
              <Button type="link" danger loading={batchDeleteLoading}>
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      />
    </PageContainer>
  );
};

export default MenuList;
