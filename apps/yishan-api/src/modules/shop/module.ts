/**
 * 商城模块 meta。
 *
 * - `id`：模块唯一标识，路由 prefix 硬约定为 `/api/${id}`。
 * - `enabled`：装载开关。false 时启动跳过 sync/mount。流量开关是 `sys_module.enabled`。
 */
export const meta = {
  id: 'shop',
  enabled: true,
}
