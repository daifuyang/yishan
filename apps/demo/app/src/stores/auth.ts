import { createAuthStore } from '@yishan/core-app/auth'
import * as authApi from '../api/auth'
import * as client from '../api/client'
import type { CurrentUser } from '../api/types'
import { redirectToLogin } from '../utils/router'
import { storage, STORAGE_KEYS } from '../utils/storage'

export const { useAuthStore, loadIdentity, setupAuthInterceptor } = createAuthStore<CurrentUser, authApi.LoginParams>({
  api: authApi,
  client,
  storage,
  storageKeys: STORAGE_KEYS,
  onUnauthorized: redirectToLogin,
})
