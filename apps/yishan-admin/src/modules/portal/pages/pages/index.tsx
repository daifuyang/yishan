/**
 * Portal 页面管理页面
 *
 * 功能：页面列表查询、创建、编辑、删除
 */

import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDateTimePicker,
  ProFormRadio,
  ProFormText,
  ProFormTextArea,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space } from 'antd';
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
  publishTime: string | null;
  createdAt: string;
}

interface ListResp {
  total: number;
  items: PortalPage[];
}

interface FormValues {
  title: string;
  path: string;
  content: string;
  status?: '0' | '1';
  publishTime?: string;
}

const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '禁用', status: 'Default' },
  '1': { text: '启用', status: 'Success' },
};

const Pages: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [formValues, setFormValues] = useState<Partial<FormValues>>({
    status: '1',
  });

  const handleSuccess = () => {
    setFormVisible(false);
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
      setFormValues({
        title: data.title,
        path: data.path,
        content: data.content,
        status: data.status != null ? (String(data.status) as '0' | '1') : '1',
        publishTime: data.publishTime ?? undefined,
      });
      setEditingId(id);
      setFormVisible(true);
    } catch {
      message.error('获取页面详情失败');
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
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleEdit(record.id)}>编辑</a>
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
              setFormVisible(true);
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
            status: restParams.status as number | undefined,
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

      <ModalForm<FormValues>
        title={editingId ? '编辑页面' : '新建页面'}
        open={formVisible}
        onOpenChange={setFormVisible}
        width={720}
        layout="horizontal"
        labelCol={{ span: 4 }}
        initialValues={formValues}
        onFinish={async (values) => {
          const body = {
            title: values.title,
            path: values.path,
            content: values.content,
            status: values.status != null ? Number(values.status) : 1,
            publishTime: values.publishTime,
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
          label="标题"
          placeholder="请输入页面标题"
          rules={[{ required: true, message: '请输入页面标题' }]}
        />
        <ProFormText
          name="path"
          label="路径"
          placeholder="页面路径，如 /about"
          rules={[{ required: true, message: '请输入页面路径' }]}
        />
        <ProFormTextArea
          name="content"
          label="正文"
          placeholder="请输入页面正文"
          fieldProps={{ rows: 6 }}
          rules={[{ required: true, message: '请输入页面正文' }]}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' },
          ]}
        />
        <ProFormDateTimePicker
          name="publishTime"
          label="发布时间"
          placeholder="选择发布时间"
        />
      </ModalForm>
    </PageContainer>
  );
};

export default Pages;
