import { PlusOutlined, DownOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, message, Popconfirm, Space, Tag, Dropdown } from 'antd';
import React, { useRef, useState } from 'react';
import { getRoleList, updateRole, createRole, getRoleDetail, deleteRole } from '@/services/yishan-admin/sysRoles';
import RoleForm from './components/RoleForm';

/**
 * 角色状态枚举
 */
const RoleStatus = {
  ENABLED: 1,
  DISABLED: 0,
};

/**
 * 是否系统角色枚举
 */
const IsSystem = {
  YES: 1,
  NO: 0,
};

/**
 * 角色状态标签
 */
const RoleStatusTag: React.FC<{ status?: number }> = ({ status }) => {
  if (status === RoleStatus.ENABLED) {
    return <Tag color="success">启用</Tag>;
  }
  return <Tag color="error">禁用</Tag>;
};

/**
 * 系统角色标签
 */
const SystemRoleTag: React.FC<{ isSystem?: number }> = ({ isSystem }) => {
  if (isSystem === IsSystem.YES) {
    return <Tag color="blue">系统角色</Tag>;
  }
  return <Tag color="green">自定义角色</Tag>;
};

/**
 * 角色管理列表页面
 */
const RoleList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('新建角色');
  const [currentRole, setCurrentRole] = useState<API.sysRole | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);

  /**
   * 处理角色状态变更
   */
  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === RoleStatus.ENABLED ? RoleStatus.DISABLED : RoleStatus.ENABLED;
      await updateRole(
        { id },
        { status: newStatus as 0 | 1 }
      );
      message.success('状态更新成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    }
  };

  /**
   * 打开新建角色表单
   */
  const handleAdd = () => {
    setFormTitle('新建角色');
    setCurrentRole(undefined);
    setFormOpen(true);
  };

  /**
   * 打开编辑角色表单
   */
  const handleEdit = async (id: number) => {
    try {
      setFormTitle('编辑角色');
      const result = await getRoleDetail({ id });
      if (result.success && result.data) {
        setCurrentRole(result.data);
        setFormOpen(true);
      }
    } catch (error) {
      message.error('获取角色详情失败');
    }
  };

  /**
   * 处理角色删除
   */
  const handleRemove = async (id: number) => {
    try {
      await deleteRole({ id });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
    }
  };

  /**
   * 处理批量删除角色
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的角色');
      return;
    }

    setBatchDeleteLoading(true);
    
    try {
      // 由于没有批量删除接口，使用单个删除的方式
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
      
      // 清空选中项并刷新列表
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      console.error('批量删除操作失败:', error);
      
      // 根据错误类型提供更具体的错误信息
      if (error?.response?.status === 403) {
        message.error('没有权限执行批量删除操作');
      } else if (error?.response?.status === 400) {
        message.error('请求参数错误，请检查选中的角色');
      } else if (error?.response?.status >= 500) {
        message.error('服务器错误，请稍后重试');
      } else {
        message.error('批量删除操作失败，请稍后重试');
      }
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  /**
   * 处理表单提交
   */
  const handleFormSubmit = async (values: API.saveRoleReq & { menuIds?: number[] }) => {
    try {
      setConfirmLoading(true);
      if (currentRole?.id) {
        // 编辑角色
        const payload: API.updateRoleReq = {
          name: values.name,
          description: values.description,
          status: values.status,
          menuIds: values.menuIds,
        };
        await updateRole(
          { id: currentRole.id },
          payload
        );
        message.success('角色更新成功');
      } else {
        // 新建角色
        await createRole(values);
        message.success('角色创建成功');
      }
      setFormOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  /**
   * 表格列定义
   */
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
      valueEnum: {
        [RoleStatus.ENABLED]: { text: '启用', status: 'Success' },
        [RoleStatus.DISABLED]: { text: '禁用', status: 'Error' },
      },
      render: (_, record) => <RoleStatusTag status={record.status} />,
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
              <a onClick={() => handleStatusChange(record.id || 0, record.status || 0)}>
                {record.status === RoleStatus.ENABLED ? '禁用' : '启用'}
              </a>
            ),
          },
          {
            key: 'permission',
            label: <a onClick={() => {}}>权限设置</a>,
          },
        ];
        
        return [
          <a key="edit" onClick={() => handleEdit(record.id || 0)}>
            编辑
          </a>,
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
    <>
      <ProTable<API.sysRole>
        headerTitle="角色列表"
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

      <RoleForm
        form={form}
        open={formOpen}
        title={formTitle}
        initialValues={currentRole}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        confirmLoading={confirmLoading}
      />
    </>
  );
};

export default RoleList;