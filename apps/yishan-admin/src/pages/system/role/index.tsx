import { PlusOutlined, DownOutlined } from '@ant-design/icons';
import { PageContainer, type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag, Dropdown } from 'antd';
import React, { useRef, useState } from 'react';
import { useModel } from '@umijs/max';
import { getRoleList, updateRole, deleteRole } from '@/services/yishan-admin/sysRoles';
import RoleForm from './components/RoleForm';

const IsSystem = {
  YES: 1,
  NO: 0,
};

const SystemRoleTag: React.FC<{ isSystem?: number }> = ({ isSystem }) => {
  if (isSystem === IsSystem.YES) {
    return <Tag color="blue">系统角色</Tag>;
  }
  return <Tag color="green">自定义角色</Tag>;
};

const RoleList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleStatusChange = async (id: number, status: string) => {
    const newStatus = status === "1" ? "0" : "1";
    const res = await updateRole(
      { id },
      { status: newStatus as "0" | "1" }
    );
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteRole({ id });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的角色');
      return;
    }

    setBatchDeleteLoading(true);

    const deletePromises = selectedRowKeys.map(key => deleteRole({ id: Number(key) }));
    const results = await Promise.allSettled(deletePromises);

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    if (failedCount === 0) {
      message.success(`成功删除 ${successCount} 个角色`);
    } else {
      message.warning(
        `删除完成，成功 ${successCount} 个，失败 ${failedCount} 个。失败的角色可能为系统角色、正在被使用或已不存在。`
      );
    }

    setSelectedRowKeys([]);
    actionRef.current?.reload();
    setBatchDeleteLoading(false);
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.sysRole>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
    },
    {
      title: '角色名称',
      dataIndex: 'name',
    },
    {
      title: '角色描述',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
    },
    {
      title: '系统角色',
      dataIndex: 'isSystemDefault',
      render: (_, record) => <SystemRoleTag isSystem={record.isSystemDefault ? IsSystem.YES : IsSystem.NO} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: defaultStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = {
          text: item.label,
          status: item.value === "1" ? "Success" : "Error"
        };
        return acc;
      }, {} as Record<string, { text: string; status: string }>),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => {
        const moreItems = [
          {
            key: 'status',
            label: (
              <a onClick={() => handleStatusChange(record.id || 0, record.status || "0")}>
                {record.status === "1"
                  ? (defaultStatusDict.find(item => item.value === "0")?.label || '禁用')
                  : (defaultStatusDict.find(item => item.value === "1")?.label || '启用')}
              </a>
            ),
          }
        ];

        return [
          <RoleForm
            key="edit"
            title="编辑角色"
            trigger={<a>编辑</a>}
            onFinish={handleFormSuccess}
            initialValues={record}
          />,
          <Popconfirm
            key="delete"
            title="确定要删除该角色吗？"
            onConfirm={() => handleRemove(record.id || 0)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>,
          <Dropdown key="more" menu={{ items: moreItems }}>
            <a onClick={(e) => e.preventDefault()}>
              更多 <DownOutlined />
            </a>
          </Dropdown>,
        ];
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.sysRole>
        headerTitle="角色列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <RoleForm
            key="create"
            title="新建角色"
            trigger={
              <Button type="primary">
                <PlusOutlined /> 新建
              </Button>
            }
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params;
          const result = await getRoleList({
            page: current,
            pageSize,
            ...restParams,
          });
          return {
            data: result.data || [],
            success: result.success,
            total: result.pagination?.total || 0,
          };
        }}
        columns={columns}
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
            <Space size={16}>
              <Popconfirm
                placement='bottomRight'
                title="确定要批量删除选中的角色吗？"
                description={`将删除 ${selectedRowKeys.length} 个角色，此操作不可恢复`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0 || batchDeleteLoading}
              >
                <a style={{
                  color: selectedRowKeys.length === 0 || batchDeleteLoading ? '#ccc' : '#ff4d4f',
                  cursor: selectedRowKeys.length === 0 || batchDeleteLoading ? 'not-allowed' : 'pointer'
                }}>
                  {batchDeleteLoading ? '删除中...' : '批量删除'}
                </a>
              </Popconfirm>
            </Space>
          );
        }}
      />
    </PageContainer>
  );
};

export default RoleList;
