/**
 * 模块 meta（保持扁平对象：构建期脚本用正则读取 `enabled`）。
 *
 * - `id`：模块唯一标识，必须等于目录名；路由 prefix 硬约定为 `/api/${id}`。
 * - `enabled`：装载开关。false 时启动跳过 sync/mount。流量开关是 `sys_module.enabled`。
 * - `description`：可选，OpenAPI 中 `demo` tag 的描述（Core 不再硬编码模块 tag）。
 */
export const meta = {
  id: 'demo',
  enabled: true,
  description: 'Demo module endpoints（src/modules/demo/）',
}
