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
  let pending = false
  let content = children
  if (bootstrapError && !auth.loggedIn && !loading) {
    content = (
      <ErrorState
        text={bootstrapError}
        onRetry={() => void useAuthStore.getState().bootstrap(true)}
      />
    )
  } else if (!auth.ready || auth.accessLoading) {
    pending = true
  } else if (auth.accessError) {
    content = (
      <ErrorState
        text={auth.accessError}
        onRetry={() => void useModuleStore.getState().load({ force: true })}
      />
    )
  } else if (auth.denied) {
    content = <PermissionDenied />
  } else if (!auth.allowed) {
    pending = true
  }

  return (
    <View className={`page-container ${styles.container} ${pending ? styles.pending : ''} ${className}`}>
      {pending ? <View className={styles.loading}><LoadingState /></View> : content}
    </View>
  )
}

export default PageContainer
