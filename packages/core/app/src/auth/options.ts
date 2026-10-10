import type { ApiClient } from '../request'
import type { TokenData } from '../request/types'
import type { SessionStorageKeys, Storage } from '../storage'

export interface AuthOptions<User extends { permissions?: string[] }, Credentials> {
  api: {
    login(params: Credentials): Promise<TokenData>
    logout(token?: string | null, refreshToken?: string | null): Promise<unknown>
    getCurrentUser(): Promise<User>
    getCapabilities(): Promise<{ permissions: string[]; enabledModuleIds: string[] }>
  }
  client: Pick<ApiClient, 'getSessionVersion' | 'invalidateSessionRequests' | 'setUnauthorizedHandler' | 'setTokenRefreshedHandler'>
  storage: Storage
  storageKeys: SessionStorageKeys
  onUnauthorized(): void | Promise<unknown>
}
