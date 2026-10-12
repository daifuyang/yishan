import { create } from 'zustand'

import { useAuthStore } from './auth'

/** 选择草稿的 key。跨页面传递多选结果时以此分桶。 */
export const DRAFT_KEYS = {
  userDepts: 'user-depts',
  userRoles: 'user-roles',
} as const

export type DraftKey = (typeof DRAFT_KEYS)[keyof typeof DRAFT_KEYS]

export interface SelectionDraftState {
  /** ownerKey → draftKey → ids */
  drafts: Record<string, Record<string, number[]>>
  readDraft: (key: string) => number[]
  writeDraft: (key: string, ids: number[]) => void
  consumeDraft: (key: string) => number[] | undefined
  reset: () => void
}

/**
 * 现读当前登录身份作为分桶 key。登出时 user 为 null，落到 anon 桶，
 * 因此天然读不到上一个账号的草稿 —— 不依赖任何登出钩子。
 */
function ownerKey(): string {
  const id = useAuthStore.getState()?.user?.id
  return id === undefined || id === null ? 'anon' : `u${id}`
}

function sanitize(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id): id is number => typeof id === 'number' && Number.isInteger(id)))]
}

export const useSelectionDraft = create<SelectionDraftState>((set, get) => ({
  drafts: {},

  readDraft: (key) => get().drafts[ownerKey()]?.[key] ?? [],

  writeDraft: (key, ids) =>
    set((state) => {
      const owner = ownerKey()
      return {
        drafts: {
          ...state.drafts,
          [owner]: { ...state.drafts[owner], [key]: sanitize(ids) },
        },
      }
    }),

  // 读后即删：编辑页消费一次后草稿不复存在
  consumeDraft: (key) => {
    const owner = ownerKey()
    const found = get().drafts[owner]?.[key]
    if (found === undefined) return undefined
    set((state) => {
      const nextOwner = { ...state.drafts[owner] }
      delete nextOwner[key]
      return { drafts: { ...state.drafts, [owner]: nextOwner } }
    })
    return found
  },

  reset: () => set({ drafts: {} }),
}))