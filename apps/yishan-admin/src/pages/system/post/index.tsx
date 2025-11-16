import { PlusOutlined } from '@ant-design/icons';
import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getPostList,
  createPost,
  getPostDetail,
  updatePost,
  deletePost,
} from '@/services/yishan-admin/sysPosts';
import PostForm from './components/PostForm';

const PostStatus = {
  ENABLED: 1,
  DISABLED: 0,
};

const PostStatusTag: React.FC<{ status?: 0 | 1 }> = ({ status }) => {
  if (status === PostStatus.ENABLED) return <Tag color="success">启用</Tag>;
  return <Tag color="error">禁用</Tag>;
};

const PostList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('新建岗位');
  const [currentPost, setCurrentPost] = useState<API.sysPost | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === PostStatus.ENABLED ? PostStatus.DISABLED : PostStatus.ENABLED;
      await updatePost({ id: String(id) }, { status: newStatus as 0 | 1 });
      message.success('状态更新成功');
      actionRef.current?.reload();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const handleAdd = () => {
    setFormTitle('新建岗位');
    setCurrentPost(undefined);
    setFormOpen(true);
  };

  const handleEdit = async (id: number) => {
    try {
      setFormTitle('编辑岗位');
      const result = await getPostDetail({ id: String(id) });
      if (result.success && result.data) {
        setCurrentPost(result.data);
        setFormOpen(true);
      }
    } catch (_error) {
      message.error('获取岗位详情失败');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deletePost({ id: String(id) });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的岗位');
      return;
    }
    setBatchDeleteLoading(true);
    try {
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
    } catch (error) {
      message.error('批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (values: API.savePostReq | API.updatePostReq) => {
    try {
      setConfirmLoading(true);
      if (currentPost?.id) {
        const payload: API.updatePostReq = {
          name: values.name,
          status: values.status,
          sort_order: values.sort_order,
          description: values.description,
        };
        await updatePost({ id: String(currentPost.id) }, payload);
        message.success('岗位更新成功');
      } else {
        await createPost(values as API.savePostReq);
        message.success('岗位创建成功');
      }
      setFormOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns: ProColumns<API.sysPost>[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '岗位名称', dataIndex: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [PostStatus.ENABLED]: { text: '启用', status: 'Success' },
        [PostStatus.DISABLED]: { text: '禁用', status: 'Error' },
      },
      render: (_, record) => <PostStatusTag status={record.status} />,
    },
    { title: '排序', dataIndex: 'sort_order', search: false },
    { title: '岗位描述', dataIndex: 'description', search: false, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, valueType: 'dateTime' },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => handleEdit(record.id || 0)}>编辑</a>,
        <a key="status" onClick={() => handleStatusChange(record.id || 0, record.status || 0)}>
          {record.status === PostStatus.ENABLED ? '禁用' : '启用'}
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
    <>
      <ProTable<API.sysPost>
        headerTitle="岗位列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Button type="primary" key="primary" onClick={handleAdd}>
            <PlusOutlined /> 新建
          </Button>,
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

      <PostForm
        form={form}
        open={formOpen}
        title={formTitle}
        initialValues={currentPost}
        onCancel={() => setFormOpen(false)}
        confirmLoading={confirmLoading}
        onSubmit={handleFormSubmit}
      />
    </>
  );
};

export default PostList;