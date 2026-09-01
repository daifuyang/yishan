/**
 * CRM 跟进记录：占位路由（autoload 要求每个文件 default export 一个 FastifyPluginAsync）。
 *
 * 真实的 GET/POST 路由已在 customers/index.ts 内以 `/:customerId/activities` 注册。
 *
 * 这里 import 共享权限文件，仅为触发模块顶层副作用（保证 crm:activity:* 在
 * PERMISSION_CODES 集合里）；不重复 registerPermissions。
 */

import type { FastifyPluginAsync } from 'fastify'
import '../../../schemas/permissions.js'

export default (async () => {
  // 实际路由在 customers/index.ts
}) as FastifyPluginAsync
