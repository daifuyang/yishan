import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, message, Popconfirm, Space } from 'antd';
import React, { useRef, useState } from 'react';
import {
  deletePosition,
  getPositionList,
  updatePosition,
} from '@/services/generated/sysPositions';
import PositionForm from './components/PositionForm';

const PositionStatus = {
  ENABLED: '1',
  DISABLED: '0',
};

/**
 * 岗位管理列表页面
 */
const PositionList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 获取全局字典数据
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};

  // 获取岗位状态字典
  const positionStatusDict: Array<{ label: string; value: string }> =
    dictDataMap.position_status || [];

  /**
   * 处理岗位状态变更
   */
  const handleStatusChange = async (id: number, status: string) => {
    const newStatus =
      status === PositionStatus.ENABLED
        ? PositionStatus.DISABLED
        : PositionStatus.ENABLED;
    const res = await updatePosition(
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

  /**
   * 处理岗位删除
   */
  const handleRemove = async (id: number) => {
    const res = await deletePosition({ id: String(id) });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  /**
   * 批量删除选中岗位
   */
  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的岗位');
      return;
    }
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deletePosition({ id: String(id) }));
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
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<API.sysPosition>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
    },
    {
      title: '岗位名称',
      dataIndex: 'name',
    },
    {
      title: '岗位编码',
      dataIndex: 'code',
      hideInTable: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      search: false,
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: positionStatusDict?.length
        ? positionStatusDict.reduce(
            (acc: Record<string, { text: string; status: string }>, item) => {
              acc[item.value] = {
                text: item.label,
                status: item.value === '1' ? 'Success' : 'Default',
              };
              return acc;
            },
            {},
          )
        : {
            '1': { text: '启用', status: 'Success' },
            '0': { text: '禁用', status: 'Default' },
          },
    },
    {
      title: '描述',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
      width: 180,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <PositionForm
            trigger={<a>编辑</a>}
            title="编辑岗位"
            initialValues={record}
            onFinish={handleFormSuccess}
          />
          <Popconfirm
            title="确定要删除该岗位吗？"
            onConfirm={() => handleRemove(record.id || 0)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
          <a
            onClick={() =>
              handleStatusChange(record.id || 0, record.status || '0')
            }
          >
            {record.status === PositionStatus.ENABLED ? '禁用' : '启用'}
          </a>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.sysPosition>
        headerTitle="岗位列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <PositionForm
            key="create"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建岗位
              </Button>
            }
            title="新建岗位"
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const result = await getPositionList({
            page: current || 1,
            pageSize: pageSize || 10,
            ...rest,
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
        tableAlertRender={({ selectedRowKeys: keys, onCleanSelected }) => (
          <Space size={24}>
            <span>已选 {keys.length} 项</span>
            <a onClick={onCleanSelected}>清空选择</a>
          </Space>
        )}
        tableAlertOptionRender={({ selectedRowKeys: keys }) => (
          <Space size={16}>
            <Popconfirm
              title={`确定要删除选中的 ${keys.length} 个岗位吗？`}
              onConfirm={handleBatchRemove}
            >
              <a style={{ color: '#ff4d4f' }}>批量删除</a>
            </Popconfirm>
          </Space>
        )}
      />
    </PageContainer>
  );
};

export default PositionList;
