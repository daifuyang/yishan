import { View } from '@tarojs/components'
import { ErrorState, LoadingState, PermissionDenied } from '@/components/feedback'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'

import styles from './PageContainer.module.scss'

export interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  const auth = useRequireAuth()
  const bootstrapError = useAuthStore((state) => state.bootstrapError)
  const loading = useAuthStore((state) => state.loading)
  const content =
    bootstrapError && !auth.loggedIn && !loading ? (
      <ErrorState
        text={bootstrapError}
        onRetry={() => void useAuthStore.getState().bootstrap(true)}
      />
    ) : !auth.ready ? (
      <LoadingState />
    ) : auth.accessLoading ? (
      <LoadingState />
    ) : auth.accessError ? (
      <ErrorState
        text={auth.accessError}
        onRetry={() => void useModuleStore.getState().load({ force: true })}
      />
    ) : auth.denied ? (
      <PermissionDenied />
    ) : auth.allowed ? (
      children
    ) : (
      <LoadingState />
    )

  return <View className={`page-container ${styles.container} ${className}`}>{content}</View>
}

export default PageContainer
