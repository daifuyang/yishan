/**
 * CRM 客户状态设置。
 *
 * 系统预置（is_system=1）不允许删除；所有 status 仅允许修改 name/sort/enabled。
 */

import { PageContainer, ProFormDigit, ProFormText, type ProColumns } from '@ant-design/pro-components'
import { Popconfirm, Space, Switch, Tag, message } from 'antd'
import React from 'react'
import {
  createStatus,
  deleteStatus,
  listStatuses,
  updateStatus,
  type StatusInput,
  type StatusRow,
} from '@/services/crm'
import { makeSettingsPage } from '../_shared'

const Page = makeSettingsPage<StatusRow, StatusInput>({
  title: '客户状态',
  headerTitle: '客户状态',
  list: (q) => listStatuses(q),
  create: (input) => createStatus(input),
  update: (id, input) => updateStatus(id, input),
  remove: async (id) => {
    try {
      await deleteStatus(id)
    } catch (err: any) {
      message.error(err?.message ?? '删除失败')
    }
  },
  columns: ({ canEdit, canDelete, onEdit, onDelete }) => {
    const cols: ProColumns<StatusRow>[] = [
      { title: 'ID', dataIndex: 'id', width: 80, search: false },
      { title: '状态名称', dataIndex: 'name', width: 200 },
      {
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: (_, r) => <Tag color={r.type === 'won' ? 'green' : r.type === 'lost' ? 'red' : 'blue'}>{r.type}</Tag>,
      },
      { title: '排序', dataIndex: 'sort', width: 100 },
      {
        title: '系统',
        dataIndex: 'isSystem',
        width: 80,
        render: (_, r) => (r.isSystem === 1 ? <Tag color="gold">系统</Tag> : '—'),
      },
      {
        title: '启用',
        dataIndex: 'enabled',
        width: 100,
        render: (_, r) => (
          <Switch
            checked={r.enabled === 1}
            onChange={async (v) => {
              try {
                await updateStatus(r.id, { enabled: v ? 1 : 0 })
                message.success('已更新')
              } catch (err: any) {
                message.error(err?.message ?? '更新失败')
              }
            }}
          />
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 170,
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
            {canEdit && record.isSystem !== 1 && (
              <a onClick={() => onEdit(record)}>编辑</a>
            )}
            {canDelete && record.isSystem !== 1 && (
              <Popconfirm
                title={`确认删除「${record.name}」？`}
                okText="删除"
                cancelText="取消"
                onConfirm={() => onDelete(record)}
              >
                <a style={{ color: '#ff4d4f' }}>删除</a>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ]
    return cols
  },
  formFields: () => (
    <>
      <ProFormText name="name" label="状态名称" rules={[{ required: true, max: 50 }]} />
      <ProFormDigit name="sort" label="排序" fieldProps={{ precision: 0 }} initialValue={0} />
      <ProFormDigit name="enabled" label="启用" fieldProps={{ precision: 0 }} initialValue={1} />
    </>
  ),
})

const StatusesPage: React.FC = () => {
  return (
    <PageContainer header={{ title: '客户状态' }}>
      <Page canCreate canEdit canDelete />
    </PageContainer>
  )
}

export default StatusesPage
