/**
 * Portal 文章管理页面
 *
 * 功能：文章列表查询、创建、编辑、删除、发布
 * 表单：DrawerForm + FormEditor（富文本）
 */

import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  PageContainer,
  ProFormDateTimePicker,
  ProFormList,
  ProFormRadio,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProForm,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import { FormEditor } from 'yishan-tiptap';
import React, { useRef, useState } from 'react';
import {
  deletePortalV1ArticlesId,
  getPortalV1Articles,
  getPortalV1ArticlesId,
  getPortalV1Categories,
  patchPortalV1ArticlesId,
  postPortalV1Articles,
  postPortalV1ArticlesIdPublish,
} from '@/services/generated/portal';

interface PortalArticle {
  id: number;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string;
  coverImage: string | null;
  status: number;
  isPinned: boolean;
  publishTime: string | null;
  attributes?: Record<string, unknown> | null;
  tags?: string[];
  categoryIds?: number[];
  createdAt: string;
  updatedAt: string;
}

const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '草稿', status: 'Default' },
  '1': { text: '已发布', status: 'Success' },
};

const ArticleList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    status: '0',
  });

  const handleSuccess = () => {
    setDrawerOpen(false);
    setEditingId(undefined);
    setFormValues({ status: '0' });
    actionRef.current?.reload();
  };

  const handleEdit = async (id: number) => {
    const res = await getPortalV1ArticlesId({ id });
    const data = res as unknown as PortalArticle;
    if (data) {
      const attrs = data.attributes as Record<string, unknown> | null | undefined;
      const attributesList = attrs
        ? Object.entries(attrs).map(([k, v]) => ({ key: k, value: String(v) }))
        : [];
      setFormValues({
        title: data.title,
        slug: data.slug ?? undefined,
        summary: data.summary ?? undefined,
        content: data.content,
        coverImage: data.coverImage ?? undefined,
        status: String(data.status),
        isPinned: data.isPinned,
        publishTime: data.publishTime ?? undefined,
        tags: data.tags ?? [],
        categoryIds: data.categoryIds ?? [],
        attributesList,
      });
      setEditingId(id);
      setDrawerOpen(true);
    } else {
      message.error('获取文章详情失败');
    }
  };

  const handleRemove = async (id: number) => {
    await deletePortalV1ArticlesId({ id }, {});
    message.success('删除成功');
    actionRef.current?.reload();
  };

  const handlePublishToggle = async (record: PortalArticle) => {
    if (record.status === 1) {
      await patchPortalV1ArticlesId(
        { id: record.id },
        { status: 0 } as Parameters<typeof patchPortalV1ArticlesId>[1],
      );
      message.success('已下线');
    } else {
      await postPortalV1ArticlesIdPublish({ id: record.id }, {});
      message.success('发布成功');
    }
    actionRef.current?.reload();
  };

  const columns: ProColumns<PortalArticle>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 64,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: statusEnum,
      width: 80,
    },
    {
      title: '置顶',
      dataIndex: 'isPinned',
      search: false,
      width: 64,
      render: (_, record) =>
        record.isPinned ? <Tag color="red">置顶</Tag> : null,
    },
    {
      title: '分类',
      dataIndex: 'categoryIds',
      search: false,
      width: 120,
      renderText: () => '-',
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      search: false,
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      search: false,
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleEdit(record.id)}>编辑</a>
          <a onClick={() => handlePublishToggle(record)}>
            {record.status === 1 ? '下线' : '发布'}
          </a>
          <Popconfirm
            title="确定要删除该文章吗？"
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
      <ProTable<PortalArticle>
        headerTitle="文章列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 100,
          defaultCollapsed: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              setEditingId(undefined);
              setFormValues({ status: '0' });
              setDrawerOpen(true);
            }}
          >
            <PlusOutlined /> 新建文章
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params;
          const result = await getPortalV1Articles({
            page: current,
            pageSize,
            keyword: restParams.keyword as string | undefined,
            status:
              restParams.status === '0' || restParams.status === '1'
                ? Number(restParams.status)
                : undefined,
          });
          const payload = result as unknown as {
            items?: PortalArticle[];
            total?: number;
          };
          const items: PortalArticle[] = (payload.items ?? []).map((item) => ({
            ...item,
            status: Number(item.status),
          }));
          return {
            data: items,
            success: true,
            total: payload.total ?? 0,
          };
        }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1200 }}
      />

      <DrawerForm
        title={editingId ? '编辑文章' : '新建文章'}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setEditingId(undefined);
          }
        }}
        grid
        drawerProps={{
          destroyOnClose: true,
          maskClosable: false,
          width: 800,
        }}
        initialValues={formValues}
        onFinish={async (values) => {
          const statusValue =
            values.status === '0' || values.status === '1'
              ? Number(values.status)
              : 0;
          const attrs: Record<string, unknown> = Array.isArray(values.attributesList)
            ? (values.attributesList as Array<{ key: string; value: string }>)
                .filter((a) => a.key?.trim())
                .reduce(
                  (acc, cur) => {
                    acc[cur.key.trim()] = cur.value;
                    return acc;
                  },
                  {} as Record<string, unknown>,
                )
            : {};
          const payload = {
            title: values.title,
            slug: values.slug || undefined,
            summary: values.summary || undefined,
            content: values.content,
            coverImage: values.coverImage || undefined,
            status: statusValue,
            isPinned: values.isPinned ?? false,
            publishTime: values.publishTime || undefined,
            attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
            tags: values.tags || undefined,
            categoryIds: values.categoryIds || undefined,
          };
          if (editingId) {
            await patchPortalV1ArticlesId(
              { id: editingId },
              payload as Parameters<typeof patchPortalV1ArticlesId>[1],
            );
          } else {
            await postPortalV1Articles(
              payload as Parameters<typeof postPortalV1Articles>[0],
            );
          }
          message.success(editingId ? '更新成功' : '创建成功');
          handleSuccess();
          return true;
        }}
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入文章标题"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入文章标题' }]}
        />
        <ProFormText
          name="slug"
          label="URL标识"
          placeholder="URL友好标识，留空自动生成"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="coverImage"
          label="封面图"
          placeholder="封面图片URL"
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="isPinned"
          label="置顶"
          colProps={{ span: 12 }}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          colProps={{ span: 12 }}
          options={[
            { label: '草稿', value: '0' },
            { label: '已发布', value: '1' },
          ]}
        />
        <ProFormDateTimePicker
          name="publishTime"
          label="发布时间"
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
          transform={(v: any) => {
            if (!v) return { publishTime: undefined };
            if (typeof v === 'string') return { publishTime: v };
            if (v?.format) return { publishTime: v.format('YYYY-MM-DD HH:mm:ss') };
            return { publishTime: undefined };
          }}
        />
        <ProFormSelect
          name="categoryIds"
          label="所属分类"
          placeholder="请选择分类"
          colProps={{ span: 24 }}
          mode="multiple"
          request={async () => {
            const res = await getPortalV1Categories({
              page: 1,
              pageSize: 100,
            });
            const payload = res as unknown as {
              items?: { id: number; name: string }[];
            };
            return (payload.items ?? []).map((c) => ({
              label: c.name,
              value: c.id,
            }));
          }}
        />
        <ProFormSelect
          name="tags"
          label="标签"
          placeholder="输入后按回车添加"
          colProps={{ span: 24 }}
          fieldProps={{
            mode: 'tags',
            tokenSeparators: [','],
          }}
        />
        <ProFormTextArea
          name="summary"
          label="摘要"
          placeholder="请输入文章摘要"
          colProps={{ span: 24 }}
        />
        <ProForm.Item
          name="content"
          label="正文"
          colProps={{ span: 24 }}
          rules={[{ required: true, message: '请输入文章正文' }]}
        >
          <FormEditor minHeight={300} />
        </ProForm.Item>
        <ProFormList
          name="attributesList"
          label="自定义属性"
          colProps={{ span: 24 }}
          creatorButtonProps={{
            position: 'bottom',
            creatorButtonText: '新增属性',
          }}
        >
          <ProFormText
            name="key"
            label="键"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="value"
            label="值"
            colProps={{ span: 12 }}
          />
        </ProFormList>
      </DrawerForm>
    </PageContainer>
  );
};

export default ArticleList;
