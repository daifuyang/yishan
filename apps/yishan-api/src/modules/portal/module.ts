/**
 * 门户模块 meta。
 *
 * - `id`：模块唯一标识，路由 prefix 硬约定为 `/api/${id}`，由 core 推导。
 * - `enabled`：首次 sync 进 sys_module 时作为 `enabled` 列的兜底值（缺省 true）。
 *   sync 永不覆盖已有 `enabled`；运行时启停完全由 sys_module 表掌握。
 */
export const meta = {
  id: 'portal',
  enabled: true,
}
