import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import * as api from '@/api/admin/dict'
import type { AdminDictData, AdminDictType } from '@/api/admin/types'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  BottomActionBar,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementPage,
  type BottomAction,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage } from '../_shared/AdminUI'

export default function DictionaryDetail({ item = false }: { item?: boolean }) {
  const guard = useRequireAuth({ moduleId: 'system-dict' })
  const current = useCurrentModuleAccess('system-dict')
  const id = Number(useRouter().params.id)
  useEffect(() => {
    if (guard.ready && guard.allowed)
      void Taro.setNavigationBarTitle({ title: item ? '字典项详情' : '字典详情' })
  }, [item, guard.ready, guard.allowed])
  const canUpdate = useCanWrite('system:dict:update')
  const canDelete = useCanWrite('system:dict:delete')
  const [record, setRecord] = useState<AdminDictType | AdminDictData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const lock = useRef(false)
  const sequence = useRef(0)
  const load = async () => {
    if (!guard.ready || !guard.allowed || lock.current) return
    const token = ++sequence.current
    setLoading(true)
    setError('')
    try {
      if (!Number.isInteger(id) || id < 1) throw new Error('字典参数无效')
      const result = item ? await api.getAdminDictData(id) : await api.getAdminDictType(id)
      if (sequence.current === token && current()) setRecord(result)
    } catch (cause) {
      if (sequence.current === token && current()) setError(errorMessage(cause))
    } finally {
      if (sequence.current === token && current()) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return () => {
      sequence.current++
    }
  }, [id, guard.ready, guard.allowed])
  useDidShow(() => {
    void load()
  })
  useDidHide(() => setOpen(false))
  const mutate = async (operation: 'delete' | 'status' | 'default') => {
    const permission = operation === 'delete' ? 'system:dict:delete' : 'system:dict:update'
    if (!record || lock.current || !current([permission])) return
    lock.current = true
    setBusy(true)
    setOpen(false)
    const token = sequence.current
    try {
      if (
        operation === 'delete' &&
        !(await confirmAction({
          title: item ? '删除字典项' : '删除字典类型',
          content: `确认删除「${'label' in record ? record.label : record.name}」？`,
        }))
      )
        return
      if (!current([permission])) return
      if (operation === 'delete') {
        if (item) await api.deleteAdminDictData(id)
        else await api.deleteAdminDictType(id)
      } else if ('isDefault' in record && operation === 'default')
        await api.updateAdminDictData(id, { isDefault: !record.isDefault })
      else if (item) await api.updateAdminDictData(id, { status: record.status === 1 ? 0 : 1 })
      else await api.updateAdminDictType(id, { status: record.status === 1 ? 0 : 1 })
      if (!current([permission]) || token !== sequence.current) return
      await Taro.showToast({ title: '操作成功', icon: 'success' })
      if (operation === 'delete') navigateBack(1)
      else {
        lock.current = false
        await load()
      }
    } catch (cause) {
      if (current([permission])) await Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      lock.current = false
      if (current()) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const actions: BottomAction[] = record
    ? [
        ...(canUpdate
          ? [
              {
                key: 'edit',
                label: '编辑',
                icon: 'pencil' as const,
                tone: 'primary' as const,
                onClick: () =>
                  navigateTo(
                    `/${item ? SYSTEM_PAGES.dictItemForm : SYSTEM_PAGES.dictForm}?id=${id}`,
                  ),
              },
              {
                key: 'status',
                label: record.status === 1 ? '禁用' : '启用',
                icon: 'check' as const,
                onClick: () => void mutate('status'),
              },
            ]
          : []),
        ...(canDelete || (canUpdate && item)
          ? [
              {
                key: 'more',
                label: '更多',
                icon: 'moreVertical' as const,
                onClick: () => setOpen(true),
              },
            ]
          : []),
      ]
    : []
  return (
    <ManagementPage withActions={Boolean(actions.length)}>
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader title={item ? '字典项详情' : '字典详情'} />
      ) : null}
      <DetailContent>
        <StateView
          kind={error ? 'error' : loading && !record ? 'loading' : record ? 'ready' : 'empty'}
          text={error || undefined}
          onRetry={load}
        >
          {record ? (
            <>
              <DetailHero
                glyph="folder"
                title={'label' in record ? record.label : record.name}
                subtitle={record.type}
                tag={
                  <Tag variant={record.status === 1 ? 'success' : 'default'}>
                    {record.status === 1 ? '启用' : '禁用'}
                  </Tag>
                }
              />
              <DetailSection title="基本信息">
                <DetailRow
                  label={item ? '字典标签' : '字典名称'}
                  value={'label' in record ? record.label : record.name}
                />
                <DetailRow label="字典类型" value={record.type} />
                {'value' in record ? (
                  <>
                    <DetailRow label="键值" value={record.value} />
                    <DetailRow label="默认值" value={record.isDefault ? '是' : '否'} />
                    <DetailRow label="标签样式" value={record.tag} />
                  </>
                ) : (
                  <DetailRow
                    label="字典项"
                    value="查看字典项"
                    showArrow
                    onClick={() => navigateTo(`/${SYSTEM_PAGES.dictItems}?typeId=${id}`)}
                  />
                )}
                <DetailRow label="排序" value={record.sort_order} />
                <DetailRow label="备注" value={record.remark} />
              </DetailSection>
              <DetailSection title="记录信息" collapsible defaultCollapsed>
                <DetailRow label="ID" value={record.id} />
                <DetailRow label="创建时间" value={formatDateTime(record.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(record.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      <BottomActionBar actions={actions} disabled={busy || loading} />
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        items={[
          ...(canUpdate && record && 'isDefault' in record
            ? [
                {
                  key: 'default',
                  label: record.isDefault ? '取消默认' : '设为默认',
                  icon: 'check' as const,
                  onClick: () => void mutate('default'),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: 'delete',
                  label: '删除',
                  icon: 'trash' as const,
                  danger: true,
                  onClick: () => void mutate('delete'),
                },
              ]
            : []),
        ]}
      />
    </ManagementPage>
  )
}
