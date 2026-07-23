/**
 * Portal 页面管理页面
 *
 * 功能：页面列表查询、创建、编辑、删除
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
  ProFormText,
  ProForm,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space } from 'antd';
import { FormEditor } from 'yishan-tiptap';
import React, { useRef, useState } from 'react';
import {
  deletePortalV1PagesId,
  getPortalV1Pages,
  getPortalV1PagesId,
  patchPortalV1PagesId,
  postPortalV1Pages,
} from '@/services/generated/portal';

interface PortalPage {
  id: number;
  title: string;
  path: string;
  content: string;
  status: number;
  attributes?: Record<string, unknown> | null;
  publishTime: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResp {
  total: number;
  items: PortalPage[];
}

const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '禁用', status: 'Default' },
  '1': { text: '启用', status: 'Success' },
};

const Pages: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    status: '1',
  });

  const handleSuccess = () => {
    setDrawerOpen(false);
    setEditingId(undefined);
    setFormValues({ status: '1' });
    actionRef.current?.reload();
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await getPortalV1PagesId({ id });
      const data = (res as unknown as PortalPage) ?? null;
      if (!data) {
        message.error('获取页面详情失败');
        return;
      }
      const attrs = data.attributes as Record<string, unknown> | null | undefined;
      const attributesList = attrs
        ? Object.entries(attrs).map(([k, v]) => ({ key: k, value: String(v) }))
        : [];
      setFormValues({
        title: data.title,
        path: data.path,
        content: data.content,
        status: String(data.status),
        publishTime: data.publishTime ?? undefined,
        attributesList,
      });
      setEditingId(id);
      setDrawerOpen(true);
    } catch {
      message.error('获取页面详情失败');
    }
  };

  const handleStatusToggle = async (record: PortalPage) => {
    try {
      const newStatus = record.status === 1 ? 0 : 1;
      await patchPortalV1PagesId({ id: record.id }, { status: newStatus }, {});
      message.success(newStatus === 1 ? '已启用' : '已禁用');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deletePortalV1PagesId({ id }, {});
      message.success('已删除');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ProColumns<PortalPage>[] = [
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
      copyable: true,
    },
    {
      title: 'URL路径',
      dataIndex: 'path',
      search: false,
      width: 200,
      copyable: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: statusEnum,
      width: 80,
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
      width: 200,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleEdit(record.id)}>编辑</a>
          <a onClick={() => handleStatusToggle(record)}>
            {record.status === 1 ? '禁用' : '启用'}
          </a>
          <Popconfirm
            title="确定要删除该页面吗？"
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
      <ProTable<PortalPage>
        headerTitle="页面列表"
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
              setFormValues({ status: '1' });
              setDrawerOpen(true);
            }}
          >
            <PlusOutlined /> 新建页面
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params;
          const res = await getPortalV1Pages({
            page: current,
            pageSize,
            keyword: restParams.keyword as string | undefined,
          });
          const data = (res as unknown as ListResp) ?? null;
          return {
            data: data?.items ?? [],
            success: true,
            total: data?.total ?? 0,
          };
        }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1000 }}
      />

      <DrawerForm
        title={editingId ? '编辑页面' : '新建页面'}
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
          const body = {
            title: values.title,
            path: values.path,
            content: values.content,
            status: values.status != null ? Number(values.status) : 1,
            publishTime: values.publishTime || undefined,
            attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
          };
          try {
            if (editingId) {
              await patchPortalV1PagesId({ id: editingId }, body, {});
            } else {
              await postPortalV1Pages(body, {});
            }
            message.success(editingId ? '更新成功' : '创建成功');
            handleSuccess();
            return true;
          } catch {
            message.error(editingId ? '更新失败' : '创建失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="title"
          label="页面标题"
          placeholder="请输入页面标题"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入页面标题' }]}
        />
        <ProFormText
          name="path"
          label="页面路径"
          placeholder="如 /about"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入页面路径' }]}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          colProps={{ span: 12 }}
          options={[
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' },
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
        <ProForm.Item
          name="content"
          label="正文"
          colProps={{ span: 24 }}
          rules={[{ required: true, message: '请输入页面正文' }]}
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

export default Pages;
