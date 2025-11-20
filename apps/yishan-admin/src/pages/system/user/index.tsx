import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag, Form } from 'antd';
import React, { useRef, useState } from 'react';
import { useModel } from '@umijs/max';
import { deleteUser, getUserList, updateUser, getUserDetail, createUser } from '@/services/yishan-admin/sysUsers';
import UserForm from './components/UserForm';

/**
 * 用户管理列表页面
 */
const UserList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTitle, setFormTitle] = useState('新建用户');
  const [currentUser, setCurrentUser] = useState<API.sysUser | undefined>(undefined);

  // 获取全局字典数据
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};

  // 获取用户状态字典
  const userStatusDict = dictDataMap.user_status || [];

  /**
   * 处理用户状态变更
   */
  const handleStatusChange = async (id: number, status: number) => {
    // 从启用切换到禁用，或从禁用切换到启用
    const newStatus = status === 1 ? 0 : 1;
    const res = await updateUser(
      { id },
      { status: newStatus as 0 | 1 | 2 }
    );
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleAdd = () => {
    setFormMode('create');
    setFormTitle('新建用户');
    setCurrentUser(undefined);
    setFormOpen(true);
  };

  const handleEdit = async (id: number) => {
    setFormMode('edit');
    setFormTitle('编辑用户');
    const detail = await getUserDetail({ id });
    if (detail.success && detail.data) {
      setCurrentUser(detail.data);
      setFormOpen(true);
    }
  };

  const handleFormSubmit = async (values: API.createUserReq | API.updateUserReq) => {
    if (formMode === 'edit' && currentUser?.id) {
      const res = await updateUser({ id: currentUser.id }, values as API.updateUserReq);
      if (res.success) {
        message.success(res.message);
      }
    } else {
      const res = await createUser(values as API.createUserReq);
      if (res.success) {
        message.success(res.message);
      }
    }
    setFormOpen(false);
    actionRef.current?.reload();
  };

  /**
   * 处理用户删除
   */
  const handleRemove = async (id: number) => {
    const res = await deleteUser({ id });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  /**
   * 批量删除选中用户
   */
  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的用户');
      return;
    }
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deleteUser({ id }));
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
      title: '昵称',
      dataIndex: 'nickname',
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
      valueEnum: userStatusDict.reduce((acc: any, item: any) => {
        acc[item.value] = {
          text: item.label,
          status: item.value === "1" ? 'Success' : item.value === "2" ? 'Warning' : 'Error'
        };
        return acc;
      }, {}),
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
        <a key="edit" onClick={() => handleEdit(record.id)}>
          编辑
        </a>,
        record.status !== 2 && (
          <a
            key="status"
            onClick={() => handleStatusChange(record.id, record.status)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </a>
        ),
        <Popconfirm
          key="delete"
          title="确定要删除该用户吗？"
          onConfirm={() => handleRemove(record.id)}
        >
          <Button className='p-0' type="link" danger disabled={record.status === 2}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
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
          onClick={handleAdd}
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
          data: result.data || [],
          success: result.success,
          total: (result as any).pagination?.total || 0,
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
    <UserForm
      form={form}
      open={formOpen}
      mode={formMode}
      title={formTitle}
      initialValues={currentUser}
      onOpenChange={setFormOpen}
      onSubmit={handleFormSubmit}
    />
    </>
  );
};

export default UserList;
