/**
 * Portal 文章管理页面
 *
 * 功能：文章列表查询、创建、编辑、删除、发布
 */

import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDateTimePicker,
  ProFormRadio,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1ArticlesId,
  getPortalV1Articles,
  getPortalV1ArticlesId,
  getPortalV1Categories,
  patchPortalV1ArticlesId,
  postPortalV1Articles,
  postPortalV1ArticlesIdPublish,
} from '@/services/generated/portal'

interface PortalArticle {
  id: number
  title: string
  slug: string | null
  summary: string | null
  content: string
  coverImage: string | null
  status: '0' | '1'
  isPinned: boolean
  publishTime: string | null
  categoryIds?: number[]
  createdAt: string
}

interface CreateArticleReq {
  title: string
  slug?: string
  summary?: string
  content: string
  coverImage?: string
  status?: '0' | '1'
  isPinned?: boolean
  publishTime?: string
  categoryIds?: number[]
}

const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '草稿', status: 'Default' },
  '1': { text: '已发布', status: 'Success' },
}

const ArticleList: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [formVisible, setFormVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [formValues, setFormValues] = useState<Partial<CreateArticleReq>>({
    status: '0',
  })

  const handleSuccess = () => {
    setFormVisible(false)
    setEditingId(undefined)
    setFormValues({ status: '0' })
    actionRef.current?.reload()
  }

  const handleEdit = async (id: number) => {
    const res = await getPortalV1ArticlesId({ id })
    const data = res as unknown as PortalArticle & {
      categoryIds?: number[]
      publishTime?: string | null
    }
    if (data) {
      setFormValues({
        title: data.title,
        slug: data.slug ?? undefined,
        summary: data.summary ?? undefined,
        content: data.content,
        coverImage: data.coverImage ?? undefined,
        status: String(data.status) as '0' | '1',
        isPinned: data.isPinned,
        publishTime: data.publishTime ?? undefined,
        categoryIds: data.categoryIds,
      })
      setEditingId(id)
      setFormVisible(true)
    } else {
      message.error('获取文章详情失败')
    }
  }

  const handleRemove = async (id: number) => {
    await deletePortalV1ArticlesId({ id }, {})
    message.success('删除成功')
    actionRef.current?.reload()
  }

  const handlePublish = async (id: number) => {
    await postPortalV1ArticlesIdPublish({ id }, {})
    message.success('发布成功')
    actionRef.current?.reload()
  }

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
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleEdit(record.id)}>编辑</a>
          {record.status === '0' && (
            <a onClick={() => handlePublish(record.id)}>发布</a>
          )}
          <Popconfirm
            title="确定要删除该文章吗？"
            onConfirm={() => handleRemove(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

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
              setEditingId(undefined)
              setFormValues({ status: '0' })
              setFormVisible(true)
            }}
          >
            <PlusOutlined /> 新建文章
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params
          const statusRaw = restParams.status
          const result = await getPortalV1Articles({
            page: current,
            pageSize,
            keyword: restParams.keyword as string | undefined,
            status:
              statusRaw === '0' || statusRaw === '1'
                ? Number(statusRaw)
                : undefined,
          })
          const payload = result as unknown as {
            items?: PortalArticle[]
            total?: number
          }
          const items: PortalArticle[] = (payload.items ?? []).map((item) => ({
            ...item,
            status: String(item.status) as '0' | '1',
          }))
          return {
            data: items,
            success: true,
            total: payload.total ?? 0,
          }
        }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1200 }}
      />

      <ModalForm<CreateArticleReq>
        title={editingId ? '编辑文章' : '新建文章'}
        open={formVisible}
        onOpenChange={setFormVisible}
        width={720}
        layout="horizontal"
        labelCol={{ span: 4 }}
        initialValues={formValues}
        onFinish={async (values) => {
          const statusValue =
            values.status === '0' || values.status === '1'
              ? Number(values.status)
              : undefined
          const payload = {
            ...values,
            status: statusValue,
          }
          if (editingId) {
            await patchPortalV1ArticlesId(
              { id: editingId },
              payload as unknown as Parameters<
                typeof patchPortalV1ArticlesId
              >[1],
            )
          } else {
            await postPortalV1Articles(
              payload as unknown as Parameters<typeof postPortalV1Articles>[0],
            )
          }
          message.success(editingId ? '更新成功' : '创建成功')
          handleSuccess()
          return true
        }}
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入文章标题"
          rules={[{ required: true, message: '请输入文章标题' }]}
        />
        <ProFormText
          name="slug"
          label="URL标识"
          placeholder="URL友好标识，留空自动生成"
        />
        <ProFormTextArea
          name="summary"
          label="摘要"
          placeholder="请输入文章摘要"
        />
        <ProFormTextArea
          name="content"
          label="正文"
          placeholder="请输入文章正文内容"
          fieldProps={{ rows: 6 }}
          rules={[{ required: true, message: '请输入文章正文' }]}
        />
        <ProFormText
          name="coverImage"
          label="封面图"
          placeholder="封面图片URL"
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '草稿', value: '0' },
            { label: '已发布', value: '1' },
          ]}
        />
        <ProFormSwitch name="isPinned" label="置顶" />
        <ProFormSelect
          name="categoryIds"
          label="分类"
          placeholder="请选择分类"
          mode="multiple"
          request={async () => {
            const res = await getPortalV1Categories({
              page: 1,
              pageSize: 100,
            })
            const payload = res as unknown as {
              items?: { id: number; name: string }[]
            }
            return (payload.items ?? []).map((c) => ({
              label: c.name,
              value: c.id,
            }))
          }}
        />
        <ProFormDateTimePicker
          name="publishTime"
          label="发布时间"
          placeholder="选择发布时间"
        />
      </ModalForm>
    </PageContainer>
  )
}

export default ArticleList
