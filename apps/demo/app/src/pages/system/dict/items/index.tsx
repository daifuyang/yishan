import { useRouter } from '@tarojs/taro'
import { useRequireAuth } from '@/utils/auth-guard'
import { useAuthStore } from '@/stores/auth'
import { PageContainer } from '@/components/layout'
import { FormError, ManagementPage, ManagementPageHeader } from '@/components/management'
import DictionaryList from '../DictionaryList'

export default function DictItemsPage() {
  const guard = useRequireAuth({ moduleId: 'system-dict' })
  const typeId = Number(useRouter().params.typeId)
  const identity = useAuthStore((state) => state.user?.id)
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  if (!Number.isInteger(typeId) || typeId < 1)
    return (
      <ManagementPage>
        <ManagementPageHeader title="字典项" />
        <FormError>字典类型参数无效</FormError>
      </ManagementPage>
    )
  return (
    <DictionaryList
      key={`${identity}:${typeId}`}
      typeId={typeId}
      enabled={guard.ready && guard.allowed}
    />
  )
}
