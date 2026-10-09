/**
 * 商城分类 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 * 表单：DrawerForm + grid 双列布局
 */

import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  DrawerForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormTreeSelect,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deleteShopV1CategoriesId,
  getShopV1Categories,
  getShopV1CategoriesId,
  patchShopV1CategoriesId,
  postShopV1Categories,
} from '@/services/generated/shop'

type Status = 0 | 1

interface Category {
  id: number
  name: string
  parentId: number | null
  coverImage: string | null
  icon: string | null
  description: string | null
  sortOrder: number
  status: number
  createdAt: string
}

interface ListResp {
  total: number
  items: Category[]
}

interface CategoryTreeNode {
  id: number
  name: string
  parentId: number | null
  children?: CategoryTreeNode[]
}

const STATUS_VALUE_ENUM: Record<string, { text: string; status: string }> = {
  0: { text: '禁用', status: 'Default' },
  1: { text: '启用', status: 'Success' },
}

const buildTree = (list: Category[]): CategoryTreeNode[] => {
  const nodes: Record<number, CategoryTreeNode> = {}
  const roots: CategoryTreeNode[] = []
  list.forEach((c) => {
    nodes[c.id] = { id: c.id, name: c.name, parentId: c.parentId }
  })
  list.forEach((c) => {
    const pid = c.parentId ?? 0
    if (pid === 0 || !nodes[pid]) {
      roots.push(nodes[c.id])
    } else {
      const p = nodes[pid]
      if (!p.children) p.children = []
      p.children.push(nodes[c.id])
    }
  })
  return [{ id: 0, name: '顶级分类', parentId: null }, ...roots]
}

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editing, setEditing] = useState<Category | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [treeData, setTreeData] = useState<CategoryTreeNode[]>([])

  const loadTree = async () => {
    const res = await getShopV1Categories({})
    const data = (res as unknown as ListResp) ?? null
    if (data?.items) {
      setTreeData(buildTree(data.items))
    }
  }

  const fetchList = async () => {
    const res = await getShopV1Categories({})
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleSave = async (values: Record<string, any>) => {
    const parentId =
      values.parentId !== undefined &&
      values.parentId !== '' &&
      values.parentId !== null &&
      Number(values.parentId) !== 0
        ? Number(values.parentId)
        : null
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
      sortOrder: values.sortOrder ?? 0,
      status: values.status ?? 1,
      parentId,
    }
    if (editing) {
      await patchShopV1CategoriesId({ id: editing.id }, payload, {})
      message.success('已更新')
    } else {
      await postShopV1Categories(payload, {})
      message.success('已创建')
    }
    setDrawerOpen(false)
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1CategoriesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Category>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: '分类名称', dataIndex: 'name', width: 160 },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 64,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueType: 'select',
      valueEnum: STATUS_VALUE_ENUM,
      render: (_, record) => (
        <Tag color={record.status === 1 ? 'success' : 'default'}>
          {record.status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={12}>
          <a
            onClick={async () => {
              await loadTree()
              setEditing(record)
              setDrawerOpen(true)
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="确定要删除该分类吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<Category>
        headerTitle="分类列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={fetchList}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 900 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={async () => {
              setEditing(null)
              await loadTree()
              setDrawerOpen(true)
            }}
          >
            新建分类
          </Button>,
        ]}
      />

      <DrawerForm
        title={editing ? `编辑分类 #${editing.id}` : '新建分类'}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setEditing(null)
        }}
        grid
        drawerProps={{
          destroyOnClose: true,
          maskClosable: false,
          width: 640,
        }}
        initialValues={
          editing
            ? {
                name: editing.name,
                sortOrder: editing.sortOrder,
                status: editing.status as Status,
                parentId: editing.parentId ?? undefined,
                description: editing.description ?? '',
              }
            : { sortOrder: 0, status: 1 }
        }
        onFinish={async (values) => {
          await handleSave(values)
          return true
        }}
      >
        <ProFormTreeSelect
          name="parentId"
          label="上级分类"
          colProps={{ span: 24 }}
          fieldProps={{
            treeData,
            fieldNames: { label: 'name', value: 'id', children: 'children' },
            allowClear: true,
            treeDefaultExpandAll: true,
            style: { width: '100%' },
            showSearch: true,
          }}
        />
        <ProFormText
          name="name"
          label="分类名称"
          placeholder="请输入分类名称"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入分类名称' }]}
        />
        <ProFormDigit
          name="sortOrder"
          label="排序"
          colProps={{ span: 12 }}
          fieldProps={{ min: 0 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          colProps={{ span: 12 }}
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="分类描述"
          colProps={{ span: 24 }}
        />
      </DrawerForm>
    </PageContainer>
  )
}

export default Categories
