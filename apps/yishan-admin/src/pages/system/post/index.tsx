import { PlusOutlined } from '@ant-design/icons';
import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space } from 'antd';
import React, { useRef, useState } from 'react';
import { getPostList, updatePost, deletePost } from '@/services/yishan-admin/sysPosts';
import PostForm from './components/PostForm';
import { useModel } from '@umijs/max';

const PostStatus = {
  ENABLED: "1",
  DISABLED: "0",
} as const;

const PostList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleStatusChange = async (id: number, status: "0" | "1") => {
    const newStatus = status === PostStatus.ENABLED ? PostStatus.DISABLED : PostStatus.ENABLED;
    const res = await updatePost({ id: String(id) }, { status: newStatus as "0" | "1" });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deletePost({ id: String(id) });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的岗位');
      return;
    }
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deletePost({ id: String(id) }));
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



  const columns: ProColumns<API.sysPost>[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '岗位名称', dataIndex: 'name' },
    { title: '排序', dataIndex: 'sort_order', search: false },
    { title: '岗位描述', dataIndex: 'description', search: false, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, valueType: 'dateTime' },
    {
      title: '状态',
      dataIndex: 'status',
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
      render: (_, record) => [
        <PostForm
          key="edit"
          title="编辑岗位"
          trigger={<a>编辑</a>}
          initialValues={record}
          onFinish={handleFormSuccess}
        />,
        <a key="status" onClick={() => handleStatusChange(record.id || 0, (record.status || '0'))}>
          {record.status === PostStatus.ENABLED
            ? (defaultStatusDict.find(item => item.value === '0')?.label || '禁用')
            : (defaultStatusDict.find(item => item.value === '1')?.label || '启用')}
        </a>,
        <Popconfirm key="delete" title="确定要删除该岗位吗？" onConfirm={() => handleRemove(record.id || 0)}>
          <Button className='p-0' type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.sysPost>
      headerTitle="岗位列表"
      actionRef={actionRef}
      rowKey="id"
      search={{ labelWidth: 120 }}
      toolBarRender={() => [
        <PostForm
          key="create"
          title="新建岗位"
          trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
          onFinish={handleFormSuccess}
        />,
      ]}
      request={async (params) => {
        const { current, pageSize, keyword, status } = params as any;
        const result = await getPostList({
          page: current,
          pageSize,
          keyword,
          status,
        });
        return {
          data: result.data || [],
          success: result.success,
          total: (result as any).pagination?.total || 0,
        };
      }}
      columns={[
        // 扩展查询字段：关键词（匹配名称、描述）
        {
          title: '关键词',
          dataIndex: 'keyword',
          hideInTable: true,
        },
        // 其余展示列
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
              title={`确定要删除选中的 ${selectedRowKeys.length} 个岗位吗？`}
              onConfirm={handleBatchRemove}
            >
              <Button type="link" danger loading={batchDeleteLoading}>
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        );
      }}
    />
  );
};

export default PostList;
