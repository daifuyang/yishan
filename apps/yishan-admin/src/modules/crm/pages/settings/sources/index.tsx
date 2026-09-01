/**
 * CRM 客户来源设置。
 */

import { PageContainer, ProFormDigit, ProFormText, type ProColumns } from '@ant-design/pro-components'
import { Popconfirm, Space, Switch, message } from 'antd'
import React from 'react'
import {
  createSource,
  deleteSource,
  listSources,
  updateSource,
  type SourceInput,
  type SourceRow,
} from '@/services/crm'
import { makeSettingsPage } from '../_shared'

const Page = makeSettingsPage<SourceRow, SourceInput>({
  title: '客户来源',
  headerTitle: '客户来源',
  list: (q) => listSources(q),
  create: (input) => createSource(input),
  update: (id, input) => updateSource(id, input),
  remove: (id) => deleteSource(id),
  columns: ({ canEdit, canDelete, onEdit, onDelete }) => {
    const cols: ProColumns<SourceRow>[] = [
      { title: 'ID', dataIndex: 'id', width: 80, search: false },
      { title: '来源名称', dataIndex: 'name', width: 200 },
      { title: '标识', dataIndex: 'code', width: 140 },
      { title: '排序', dataIndex: 'sort', width: 100 },
      {
        title: '启用',
        dataIndex: 'enabled',
        width: 100,
        render: (_, r) => (
          <Switch
            checked={r.enabled === 1}
            onChange={async (v) => {
              try {
                await updateSource(r.id, { enabled: v ? 1 : 0 })
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
            {canEdit && <a onClick={() => onEdit(record)}>编辑</a>}
            {canDelete && (
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
      <ProFormText name="name" label="来源名称" rules={[{ required: true, max: 50 }]} />
      <ProFormText name="code" label="标识" rules={[{ max: 50 }]} />
      <ProFormDigit name="sort" label="排序" fieldProps={{ precision: 0 }} initialValue={0} />
      <ProFormDigit name="enabled" label="启用" fieldProps={{ precision: 0 }} initialValue={1} />
    </>
  ),
})

const SourcesPage: React.FC = () => {
  return (
    <PageContainer header={{ title: '客户来源' }}>
      <Page canCreate canEdit canDelete />
    </PageContainer>
  )
}

export default SourcesPage
