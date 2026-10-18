import type {} from '../../types/index';
import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useSystemAdmin } from '../../runtime';
import { Button, message, Modal, Popconfirm, Space } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  deleteUser,
  getUserList,
  getUserDetail,
  updateUser,
} from '../../services/generated/sysUsers';
import UserForm from './components/UserForm';
import {
  consumeAiPrefill,
  subscribeAiPrefill,
  publishAiPrefillResult,
} from '../../ai-prefill';
import { AiPrefillGate } from '../../components/AiPrefillGate';

/**
 * 用户管理列表页面
 */
const UserList: React.FC = () => {
  const [modal, modalContext] = Modal.useModal();
  const deleteConfirmation = useRef(false);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  /** 唯一的「新建用户」表单开关：手动按钮与助手协作 open() 共用它。 */
  const [createOpen, setCreateOpen] = useState(false);

  // 获取全局字典数据
  const { initialState } = useSystemAdmin();
  const dictDataMap = initialState?.dictDataMap || {};

  // 获取用户状态字典
  const userStatusDict: Array<{ label: string; value: string }> =
    dictDataMap.user_status || [];

  /**
   * 处理用户状态变更
   */
  const handleStatusChange = async (id: number, status: string) => {
    // 从启用切换到禁用，或从禁用切换到启用
    const newStatus = status === '1' ? '0' : '1';
    const res = await updateUser(
      { id },
      { status: newStatus as '0' | '1' | '2' },
    );
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  /**
   * 处理用户删除
   */
  const handleRemove = async (id: number) => {
    const res = await deleteUser({ id });
    if (!res.success) throw new Error(res.message || '删除失败，请重试');
    message.success(res.message);
    actionRef.current?.reload();
  };

  useEffect(() => {
    let alive = true;
    let dialog: ReturnType<typeof modal.confirm> | undefined;
    const consume = () => {
      if (deleteConfirmation.current) return;
      const request = consumeAiPrefill('user.delete');
      if (!request) return;
      const id = request.fields.id;
      const feedback = (
        status: 'completed' | 'failed' | 'notice',
        text: string,
      ) => {
        if (alive && request.requestId)
          publishAiPrefillResult({
            requestId: request.requestId,
            status,
            message: text,
          });
      };
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
        feedback('failed', '删除目标无效，请重新查询');
        return;
      }
      deleteConfirmation.current = true;
      void (async () => {
        try {
          const response = await getUserDetail({ id });
          if (!alive) return;
          if (!response.success || !response.data || response.data.id !== id)
            throw new Error('无法读取要删除的用户，请重新查询');
          if (response.data.status === '2')
            throw new Error('该用户处于锁定状态，不能从此入口删除');
          const label =
            response.data.realName ||
            response.data.username ||
            response.data.phone ||
            String(id);
          dialog = modal.confirm({
            title: '确认删除该用户？',
            content:
              '将删除「' +
              label +
              '」（ID：' +
              id +
              '），请核对目标用户后确认。',
            okText: '确认删除',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onCancel: () => {
              deleteConfirmation.current = false;
              feedback('notice', '已取消删除，未修改用户数据。');
            },
            onOk: async () => {
              if (!alive) throw new Error('页面已切换，请重新确认');
              try {
                await handleRemove(id);
                deleteConfirmation.current = false;
                feedback(
                  'completed',
                  '已删除用户「' + label + '」（ID：' + id + '）。',
                );
              } catch {
                feedback(
                  'failed',
                  '删除失败，未确认删除结果，请在用户列表核对后重试。',
                );
                throw new Error('删除失败，请重试');
              }
            },
          });
        } catch (cause) {
          deleteConfirmation.current = false;
          feedback(
            'failed',
            cause instanceof Error ? cause.message : '无法打开删除确认，请重试',
          );
        }
      })();
    };
    consume();
    const unsubscribe = subscribeAiPrefill(consume);
    return () => {
      alive = false;
      unsubscribe();
      dialog?.destroy();
      deleteConfirmation.current = false;
    };
  }, [initialState?.currentUser?.id, modal]);

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

    const successCount = results.filter(
      (result) => result.status === 'fulfilled' && result.value.success,
    ).length;
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
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SystemAPI.sysUser>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      search: {
        // API 的列表契约使用 keyword（匹配用户名、姓名、邮箱、昵称）；
        // 不要把 UI 字段名 username 原样传给接口，否则筛选条件会被忽略。
        transform: (value) => ({ keyword: value }),
      },
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      // 当前 API 不支持独立 realName 参数，避免向接口发送无效字段。
      search: false,
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
      valueEnum: userStatusDict.reduce(
        (acc: Record<string, { text: string; status: string }>, item) => {
          acc[item.value] = {
            text: item.label,
            status:
              item.value === '1'
                ? 'Success'
                : item.value === '2'
                  ? 'Warning'
                  : 'Error',
          };
          return acc;
        },
        {} as Record<string, { text: string; status: string }>,
      ),
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
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <UserForm
            title="编辑用户"
            trigger={<a>编辑</a>}
            onFinish={handleFormSuccess}
            initialValues={record}
          />
          {record.status !== '2' && (
            <a onClick={() => handleStatusChange(record.id, record.status)}>
              {record.status === '1' ? '禁用' : '启用'}
            </a>
          )}
          <Popconfirm
            title="确定要删除该用户吗？"
            onConfirm={() => handleRemove(record.id)}
          >
            <a
              aria-disabled={record.status === '2'}
              onClick={(event) => {
                if (record.status === '2') event.preventDefault();
              }}
              style={{
                color: '#ff4d4f',
                pointerEvents: record.status === '2' ? 'none' : undefined,
              }}
            >
              删除
            </a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      {modalContext}
      {/*
        用户创建**只有一个**表单实例，就是下面这个受控的 UserForm：
        工具栏「新建」按钮、AI 一次性预填（UserForm 内部消费）和助手的协作 open()
        三条路径都进入它，保存仍由用户在原有「确定」上完成。
        这里刻意**不再**为 user.create 挂 AiPrefillGate —— 那会让助手打开第二个
        弹窗，与「当前表单协作」的设计相悖。

        顺序也有讲究：预填是一次性消费，先挂载的一方先拿到。创建表单必须排在
        user.update 的 Gate 前面，否则 user.update 的 Gate 会把 user.create 的
        预填先取走再丢掉。
      */}
      <UserForm
        title="新建用户"
        assistance="user.create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleFormSuccess}
      />
      <AiPrefillGate
        target="user.update"
        mapFields={(fields) => {
          const { deptId, ...rest } = fields;
          return {
            ...rest,
            ...(deptId === undefined ? {} : { deptIds: [deptId as number] }),
          };
        }}
      >
        {({ open, initialValues, close, requestId }) => (
          <UserForm
            title="编辑用户"
            aiPrefill={{ requestId, fields: initialValues }}
            open={open}
            onOpenChange={(next) => {
              if (!next) close();
            }}
            initialValues={initialValues as Partial<SystemAPI.sysUser>}
            onFinish={handleFormSuccess}
          />
        )}
      </AiPrefillGate>
      <ProTable<SystemAPI.sysUser>
        headerTitle="用户列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => setCreateOpen(true)}
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
        scroll={{ x: 1600 }}
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
                <Button
                  className="p-0"
                  type="link"
                  danger
                  disabled={selectedRowKeys.length === 0}
                >
                  批量删除
                </Button>
              </Popconfirm>
              <Button
                className="p-0"
                type="link"
                onClick={() => message.info('暂未实现')}
              >
                批量导出
              </Button>
            </Space>
          );
        }}
      />
    </PageContainer>
  );
};

export default UserList;
