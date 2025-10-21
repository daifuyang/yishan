import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { useIntl } from '@umijs/max';
import { deleteUser, getUserList, updateUserStatus, batchDeleteUsers } from '@/services/yishan-admin/sysUsers';

/**
 * 用户状态枚举
 */
const UserStatus = {
  ACTIVE: 1,
  DISABLED: 0,
  LOCKED: 2,
};

/**
 * 用户状态标签
 */
const UserStatusTag: React.FC<{ status?: number }> = ({ status }) => {
  if (status === UserStatus.ACTIVE) {
    return <Tag color="success">正常</Tag>;
  } else if (status === UserStatus.LOCKED) {
    return <Tag color="warning">锁定</Tag>;
  }
  return <Tag color="error">禁用</Tag>;
};

/**
 * 用户管理列表页面
 */
const UserList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const intl = useIntl();

  /**
   * 处理用户状态变更
   */
  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === UserStatus.ACTIVE ? UserStatus.DISABLED : UserStatus.ACTIVE;
      await updateUserStatus(
        { id },
        { status: newStatus as 0 | 1 | 2 }
      );
      message.success('状态更新成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    }
  };

  /**
   * 处理用户删除
   */
  const handleRemove = async (id: number) => {
    try {
      await deleteUser({ id });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
    }
  };

  /**
   * 批量删除选中用户
   */
  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的用户');
      return;
    }
    try {
      const ids = selectedRowKeys.map((key) => Number(key));
      const res = await batchDeleteUsers({ userIds: ids });
      const successCount = res.data?.successCount || 0;
      const failureCount = res.data?.failureCount || 0;

      if (successCount > 0) {
        message.success(`批量删除完成：成功 ${successCount}，失败 ${failureCount}`);
      } else {
        message.error('批量删除失败');
      }

      // 可选：提示失败详情
      if (failureCount > 0 && res.data?.details?.length) {
        const failed = res.data.details.filter((d) => d.success === false);
        const tip = failed.map((f) => `ID ${f.id}: ${f.message}`).join('\n');
        if (tip) {
          message.warning(tip);
        }
      }

      actionRef.current?.reload();
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<API.sysUser>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
    },
    {
      title: '用户名',
      dataIndex: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'realName',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [UserStatus.ACTIVE]: { text: '正常', status: 'Success' },
        [UserStatus.DISABLED]: { text: '禁用', status: 'Error' },
        [UserStatus.LOCKED]: { text: '锁定', status: 'Warning' },
      },
      render: (_, record) => <UserStatusTag status={record.status} />,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginTime',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => { }}>
          编辑
        </a>,
        record.status !== UserStatus.LOCKED && (
          <a
            key="status"
            onClick={() => handleStatusChange(record.id || 0, record.status || 0)}
          >
            {record.status === UserStatus.ACTIVE ? '禁用' : '启用'}
          </a>
        ),
        <Popconfirm
          key="delete"
          title="确定要删除该用户吗？"
          onConfirm={() => handleRemove(record.id || 0)}
        >
          <Button className='p-0' type="link" danger disabled={record.status === UserStatus.LOCKED}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.sysUser>
      headerTitle="用户列表"
      actionRef={actionRef}
      rowKey="id"
      search={{
        labelWidth: 120,
      }}
      toolBarRender={() => [
        <Button
          type="primary"
          key="primary"
          onClick={() => { }}
        >
          <PlusOutlined /> 新建
        </Button>,
      ]}
      request={async (params) => {
        const { current, pageSize, ...restParams } = params;
        const result = await getUserList({
          page: current,
          pageSize,
          ...restParams,
        });
        return {
          data: result.data?.list || [],
          success: result.success,
          total: result.data?.pagination?.total || 0,
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
          <Space>
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 个用户吗？`}
              onConfirm={handleBatchRemove}
              disabled={selectedRowKeys.length === 0}
            >
              <Button className='p-0' type="link" danger disabled={selectedRowKeys.length === 0}>
                批量删除
              </Button>
            </Popconfirm>
            <Button className='p-0' type="link" onClick={() => message.info('暂未实现')}>
              批量导出
            </Button>
          </Space>
        );
      }}
    />
  );
};

export default UserList;