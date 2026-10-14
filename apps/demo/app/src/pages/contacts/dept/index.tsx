import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'

import { contactsApi } from '@/api'
import type { DeptUser } from '@/api/types'
import {
  ManagementCell,
  ManagementList,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
} from '@/components/management'
import { useRequireAuth } from '@/utils/auth-guard'
import { errorMessage, withAccountScope } from '@/utils/account-scope'

function readDeptName(name?: string): string {
  if (!name) return '部门'
  try {
    return decodeURIComponent(name)
  } catch {
    // 兼容已解码且包含百分号的名称，以及不完整的 URL 编码。
    return name
  }
}

function ContactsDept() {
  const router = useRouter()
  const deptId = Number(router.params.id)
  const deptName = readDeptName(router.params.name)

  const [users, setUsers] = useState<DeptUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const guard = useRequireAuth()

  const load = async () => {
    if (!guard.ready || !guard.allowed) return
    setLoading(true)
    setError(null)
    try {
      const data = await contactsApi.getDeptUsers(deptId)
      setUsers(data || [])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (deptId && guard.ready && guard.allowed) {
      Taro.setNavigationBarTitle({ title: `${deptName}成员` })
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId, guard.ready, guard.allowed])

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  return (
    <ManagementPage>
      <ManagementPageHeader title={deptName} />
      <ManagementStates
        kind={
          error
            ? 'error'
            : loading && !users.length
              ? 'loading'
              : !users.length
                ? 'empty'
                : 'ready'
        }
        errorText={error || undefined}
        emptyText="该部门暂无成员"
        onRetry={() => void load()}
      >
        <ManagementList>
          {users.map((u, idx) => (
            <ManagementCell
              key={u.id}
              avatar={{ src: u.avatar, name: u.realName || u.username || '' }}
              title={u.realName || u.username || '-'}
              description={u.phone || u.email || '-'}
              showArrow={false}
              bordered={idx < users.length - 1}
            />
          ))}
        </ManagementList>
      </ManagementStates>
    </ManagementPage>
  )
}

export default withAccountScope(ContactsDept)
