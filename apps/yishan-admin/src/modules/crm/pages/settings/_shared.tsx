/**
 * 共享：设置类页面的通用 CRUD 页面骨架。
 * 由 tags / statuses / sources 三个页面 import 使用。
 */

import {
  type ActionType,
  DrawerForm,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space } from 'antd'
import React, { useRef, useState } from 'react'

export interface SimpleSettingRow {
  id: number
  name: string
  enabled?: number
  sort?: number
  isSystem?: number
}

export interface SimpleSettingInput {
  name: string
  enabled?: number
  sort?: number
}

export interface SettingConfig<T extends SimpleSettingRow, I extends SimpleSettingInput> {
  title: string
  headerTitle: string
  columns: (hooks: {
    canEdit: boolean
    canDelete: boolean
    onEdit: (r: T) => void
    onDelete: (r: T) => Promise<void>
  }) => ProColumns<T>[]
  formFields: (form: {
    isEdit: boolean
  }) => React.ReactNode
  list: (q: any) => Promise<{ data: T[]; total: number }>
  create: (input: I) => Promise<T>
  update: (id: number, input: Partial<I>) => Promise<T>
  remove: (id: number) => Promise<void>
  /** 业务侧额外校验：返回 true 表示允许删除。 */
  canDeleteRow?: (r: T) => boolean
  /** 业务侧额外校验：返回 true 表示允许编辑。 */
  canEditRow?: (r: T) => boolean
}

export function makeSettingsPage<T extends SimpleSettingRow, I extends SimpleSettingInput>(
  cfg: SettingConfig<T, I>,
) {
  const Page: React.FC<{
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
  }> = ({ canCreate, canEdit, canDelete }) => {
    const actionRef = useRef<ActionType>(null)
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<T | null>(null)

    const handleSubmit = async (values: any) => {
      try {
        if (editing) {
          await cfg.update(editing.id, values)
          message.success('已更新')
        } else {
          await cfg.create(values)
          message.success('已创建')
        }
        setOpen(false)
        setEditing(null)
        actionRef.current?.reload()
        return true
      } catch (err: any) {
        message.error(err?.message ?? '操作失败')
        return false
      }
    }

    const handleDelete = async (r: T) => {
      await cfg.remove(r.id)
      message.success('已删除')
      actionRef.current?.reload()
    }

    const columns = cfg.columns({
      canEdit,
      canDelete,
      onEdit: (r) => {
        setEditing(r)
        setOpen(true)
      },
      onDelete: async (r) => {
        await handleDelete(r)
      },
    })

    return (
      <>
        <ProTable<T>
          headerTitle={cfg.headerTitle}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          search={{ labelWidth: 'auto' }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          request={async (params) => {
            const { current, pageSize, ...rest } = params as Record<string, unknown>
            const res = await cfg.list({
              page: (current as number) ?? 1,
              pageSize: (pageSize as number) ?? 20,
              keyword: (rest.keyword as string) ?? '',
            })
            return {
              data: res.data,
              success: true,
              total: res.total,
            }
          }}
          toolBarRender={() =>
            canCreate
              ? [
                  <Button
                    key="create"
                    type="primary"
                    onClick={() => {
                      setEditing(null)
                      setOpen(true)
                    }}
                  >
                    新建
                  </Button>,
                ]
              : []
          }
        />

        <DrawerForm
          title={editing ? '编辑' : '新建'}
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) setEditing(null)
          }}
          onFinish={handleSubmit}
          initialValues={editing ?? { enabled: 1, sort: 0 }}
          drawerProps={{ destroyOnClose: true, width: 480 }}
        >
          <>{cfg.formFields({ isEdit: !!editing })}</>
        </DrawerForm>
      </>
    )
  }
  return Page
}
