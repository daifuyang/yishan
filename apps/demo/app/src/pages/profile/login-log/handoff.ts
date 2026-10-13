import type { LoginLog } from '@/api/types'

// 个人登录记录没有按 ID 查询的接口：列表点进详情时把记录交接到内存里。
// 以「用户 ID + 日志 ID」为键，切换账号后读不到上一个账号的记录；
// H5 直接刷新详情页时内存为空，由详情页显示空状态。
const records = new Map<string, LoginLog>()
const keyOf = (ownerId: number, id: number) => `${ownerId}:${id}`

export function rememberLoginLog(ownerId: number, log: LoginLog) {
  records.set(keyOf(ownerId, log.id), log)
}

export function recallLoginLog(ownerId: number | undefined, id: number): LoginLog | null {
  return ownerId === undefined ? null : records.get(keyOf(ownerId, id)) ?? null
}
