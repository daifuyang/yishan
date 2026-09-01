/**
 * CRM 客户标签设置。
 */

import { PageContainer, ProFormDigit, ProFormText, type ProColumns } from '@ant-design/pro-components'
import { Popconfirm, Space, Switch, message } from 'antd'
import React from 'react'
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type TagInput,
  type TagRow,
} from '@/services/crm'
import { makeSettingsPage } from '../_shared'

const Page = makeSettingsPage<TagRow, TagInput>({
  title: '客户标签',
  headerTitle: '客户标签',
  list: (q) => listTags(q),
  create: (input) => createTag(input),
  update: (id, input) => updateTag(id, input),
  remove: (id) => deleteTag(id),
  columns: ({ canEdit, canDelete, onEdit, onDelete }) => {
    const cols: ProColumns<TagRow>[] = [
      { title: 'ID', dataIndex: 'id', width: 80, search: false },
      { title: '标签名称', dataIndex: 'name', width: 200 },
      {
        title: '颜色',
        dataIndex: 'color',
        width: 100,
        render: (_, r) =>
          r.color ? (
            <span style={{ background: r.color, padding: '2px 8px', borderRadius: 4 }}>
              {r.color}
            </span>
          ) : (
            '—'
          ),
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
                await updateTag(r.id, { enabled: v ? 1 : 0 })
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
      <ProFormText name="name" label="标签名称" rules={[{ required: true, max: 50 }]} />
      <ProFormDigit name="enabled" label="启用" fieldProps={{ precision: 0 }} initialValue={1} />
    </>
  ),
})

const TagsPage: React.FC = () => {
  return (
    <PageContainer header={{ title: '客户标签' }}>
      <Page canCreate canEdit canDelete />
    </PageContainer>
  )
}

export default TagsPage
