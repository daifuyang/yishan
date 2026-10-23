import Taro, { useDidHide, useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  BottomActionBar,
  type BottomAction,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementCell,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite, useListPagination } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import * as api from '@/api/admin/dept'
import { getDeptUsers } from '@/api/contacts'
import type { AdminDept } from '@/api/admin/types'
import type { DeptUser } from '@/api/types'
import { errorMessage, withAccountScope } from '@/utils/account-scope'

function DeptDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-dept' })
  const id = Number(useRouter().params.id)
  const validId = Number.isInteger(id) && id > 0
  const canUpdate = useCanWrite('system:department:update')
  const canCreate = useCanWrite('system:department:create')
  const canDelete = useCanWrite('system:department:delete')
  const canMembers = useCanWrite('app:contacts:dept-users')
  const isCurrent = useCurrentModuleAccess('system-dept')
  const [department, setDepartment] = useState<AdminDept | null>(null)
  const [members, setMembers] = useState<DeptUser[]>([])
  const [memberError, setMemberError] = useState('')
  const [membersLoading, setMembersLoading] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const alive = useRef(true)
  const refreshOnShow = useRef(false)
  const enabled = guard.ready && guard.allowed && validId
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setDepartment(null)
    if (!enabled) return
    setLoading(true)
    setError('')
    api
      .getAdminDept(id)
      .then((data) => {
        if (active && isCurrent()) setDepartment(data)
      })
      .catch((cause) => {
        if (active && isCurrent()) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, enabled, reload])
  useEffect(() => {
    let active = true
    setMembers([])
    setMemberError('')
    setMembersLoading(true)
    if (!enabled || !canMembers) return
    getDeptUsers(id)
      .then((data) => {
        if (active && isCurrent()) setMembers(data)
      })
      .catch((cause) => {
        if (active && isCurrent()) setMemberError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setMembersLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, enabled, canMembers, reload])
  const children = useListPagination<AdminDept>({
    enabled,
    fetcher: async ({ page, pageSize }) => {
      const { data, pagination } = await api.listAdminDepts({ parentId: id, page, pageSize })
      return { list: data, total: pagination.total }
    },
  })
  const refresh = () => {
    if (lock.current) return
    setReload((value) => value + 1)
    void children.refresh()
  }
  usePullDownRefresh(() => {
    if (!enabled || lock.current || !isCurrent()) return
    // 子部门列表由分页 hook 响应同一事件并结束刷新动画。
    setReload((value) => value + 1)
  })
  useDidHide(() => {
    refreshOnShow.current = true
    setMoreOpen(false)
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      refresh()
    }
  })
  const mutate = async (remove: boolean) => {
    if (!department || lock.current || loading) return
    const permission = remove ? 'system:department:delete' : 'system:department:update'
    if (!(remove ? canDelete : canUpdate) || !isCurrent([permission])) return
    lock.current = true
    setBusy(true)
    setMoreOpen(false)
    try {
      if (
        remove &&
        !(await confirmAction({
          title: '删除部门',
          content: `确认删除「${department.name}」？有子部门的部门不能删除。`,
        }))
      )
        return
      if (!alive.current || !isCurrent([permission])) return
      if (remove) await api.deleteAdminDept(id)
      else await api.updateAdminDept(id, { status: department.status === '1' ? '0' : '1' })
      if (!alive.current || !isCurrent([permission])) return
      await Taro.showToast({ title: '操作成功', icon: 'success' })
      if (!alive.current || !isCurrent([permission])) return
      if (remove) navigateBack(1)
      else setReload((value) => value + 1)
    } catch (cause) {
      if (alive.current && isCurrent([permission]))
        await Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  // 底部最多三个：编辑、新建子部门、更多。启用/禁用是低频且可逆的操作，
  // 长期占着底部的黄金位置不如收进「更多」。
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.deptForm}?id=${id}`),
          },
        ]
      : []),
    ...(canCreate
      ? [
          {
            key: 'child',
            label: '新建子部门',
            icon: 'plus' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.deptForm}?parentId=${id}`),
          },
        ]
      : []),
    ...((canUpdate || canDelete)
      ? [
          {
            key: 'more',
            label: '更多',
            icon: 'moreVertical' as const,
            onClick: () => setMoreOpen(true),
          },
        ]
      : []),
  ]
  const kind = !validId || error ? 'error' : loading ? 'loading' : department ? 'ready' : 'empty'
  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="部门详情" /> : null}
      <DetailContent>
        <StateView
          kind={kind}
          text={!validId ? '部门参数无效' : error || undefined}
          onRetry={validId ? refresh : undefined}
        >
          {department ? (
            <>
              <DetailHero
                glyph="folder"
                title={department.name}
                tag={
                  <Tag variant={department.status === '1' ? 'success' : 'default'}>
                    {department.status === '1' ? '启用' : '禁用'}
                  </Tag>
                }
                subtitle={department.parentName || '顶级部门'}
              />
              <DetailSection title="基本信息">
                <DetailRow label="部门名称" value={department.name} />
                <DetailRow
                  label="上级部门"
                  value={department.parentName || '顶级部门'}
                  onClick={
                    department.parentId
                      ? () => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${department.parentId}`)
                      : undefined
                  }
                />
                <DetailRow label="负责人" value={department.leaderName || department.leaderId} />
                <DetailRow label="排序" value={department.sort_order} />
                <DetailRow label="描述" value={department.description} />
              </DetailSection>
              <DetailSection
                title={`部门成员${canMembers && !membersLoading && !memberError ? ` · ${members.length}` : ''}`}
              >
                {!canMembers ? (
                  <DetailRow label="成员信息" value="暂无查看权限" />
                ) : (
                  <StateView
                    kind={
                      memberError
                        ? 'error'
                        : membersLoading
                          ? 'loading'
                          : members.length
                            ? 'ready'
                            : 'empty'
                    }
                    text={memberError || '暂无启用成员'}
                    onRetry={refresh}
                    minHeight={100}
                  >
                    <ManagementList>
                      {members.map((member, index) => (
                        <ManagementCell
                          key={member.id}
                          bordered={index < members.length - 1}
                          avatar={{
                            name: member.realName || member.username || member.phone,
                            src: member.avatar,
                          }}
                          title={member.realName || member.username || member.phone}
                          description={
                            member.phone || member.email || '暂无联系方式'
                          }
                          showArrow={false}
                        />
                      ))}
                    </ManagementList>
                  </StateView>
                )}
              </DetailSection>
              <DetailSection title={`子部门 · ${children.total}`}>
                <StateView
                  kind={
                    children.error
                      ? 'error'
                      : children.loading && !children.list.length
                        ? 'loading'
                        : children.list.length
                          ? 'ready'
                          : 'empty'
                  }
                  text={children.error || '暂无子部门'}
                  onRetry={children.refresh}
                  minHeight={100}
                >
                  <ManagementList>
                    {children.list.map((child, index) => (
                      <ManagementCell
                        key={child.id}
                        bordered={index < children.list.length - 1}
                        glyph="folder"
                        title={child.name}
                        description={`负责人：${child.leaderName || child.leaderId || '未设置'}`}
                        tag={
                          <Tag size="sm" variant={child.status === '1' ? 'success' : 'default'}>
                            {child.status === '1' ? '启用' : '禁用'}
                          </Tag>
                        }
                        onClick={() => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${child.id}`)}
                      />
                    ))}
                  </ManagementList>
                </StateView>
                <ManagementListFooter
                  loadingMore={children.loadingMore}
                  finished={children.finished}
                  empty={!children.list.length}
                />
              </DetailSection>
              <DetailSection title="部门记录" collapsible defaultCollapsed>
                <DetailRow label="部门 ID" value={department.id} />
                <DetailRow label="创建人" value={department.creatorName} />
                <DetailRow label="创建时间" value={formatDateTime(department.createdAt)} />
                <DetailRow label="更新人" value={department.updaterName} />
                <DetailRow label="更新时间" value={formatDateTime(department.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      <BottomActionBar actions={actions} disabled={busy || loading || !department || !!error} />
      <ActionSheet
        open={moreOpen}
        items={[
          // 删除排在最后：不可逆，误触代价最高
          ...(canUpdate
            ? [
                {
                  key: 'toggle',
                  label: department?.status === '1' ? '禁用部门' : '启用部门',
                  icon: 'ban' as const,
                  onClick: () => void mutate(false),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: 'delete',
                  label: '删除部门',
                  icon: 'trash' as const,
                  danger: true,
                  onClick: () => void mutate(true),
                },
              ]
            : []),
        ]}
        onClose={() => setMoreOpen(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(DeptDetailPage)
