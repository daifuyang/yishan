import Taro, { useRouter } from '@tarojs/taro'
import { useEffect } from 'react'
import { StateView } from '@/components/feedback'
import { ManagementPage, ManagementPageHeader } from '@/components/management'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import DepartmentForm from '../DepartmentForm'

function DepartmentFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-dept' })
  const params = useRouter().params
  const id = params.id ? Number(params.id) : undefined
  const parentId = params.parentId ? Number(params.parentId) : 0
  const invalid =
    (id !== undefined && (!Number.isInteger(id) || id < 1)) ||
    !Number.isInteger(parentId) ||
    parentId < 0
  const title = id ? '编辑部门' : '新建部门'
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title })
  }, [title])
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title={title} /> : null}
      {invalid ? (
        <StateView kind="error" text="部门参数无效" />
      ) : (
        <DepartmentForm departmentId={id} parentId={parentId} onSuccess={() => navigateBack(1)} />
      )}
    </ManagementPage>
  )
}
export default withAccountScope(DepartmentFormPage)
