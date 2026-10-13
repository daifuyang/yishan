import { createElement, type ComponentType } from 'react'
import { useAuthStore } from '@/stores/auth'

/** Account changes discard page drafts; ordinary token renewal keeps them. */
export function withAccountScope(Page: ComponentType) {
  return function AccountScopedPage() {
    const identity = useAuthStore((state) => state.user?.id)
    return createElement(Page, { key: identity ?? 'signed-out' })
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试'
}
