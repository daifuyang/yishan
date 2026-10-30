/**
 * crm 模块 v1 路由入口。
 *
 * 本文件只负责按"单一职责"挂载各子路由模块（每个 entity 一个），
 * 不在这里直接声明任何 route —— 真正的路由声明去它们各自的文件夹里。
 *
 * 路由 prefix 由 ModuleLoader 推导为 `/api/crm/v1`，本文件不声明。
 */

import type { FastifyPluginAsync } from 'fastify'

import hospitals from './hospitals/index.js'
import customers from './customers/index.js'
import dispatches from './dispatches/index.js'
import members from './members/index.js'
import weixin from './public/weixin/index.js'
import dashboard from './dashboard/index.js'
import hospitalDashboard from './hospital-dashboard/index.js'

export default (async (app) => {
  await app.register(hospitals)
  await app.register(customers)
  await app.register(dispatches)
  await app.register(members)
  await app.register(dashboard)
  await app.register(hospitalDashboard)
  await app.register(weixin)
}) as FastifyPluginAsync
