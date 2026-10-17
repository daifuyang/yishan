import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from '@yishan/core-system-api'
import { drizzleDb } from '@yishan/core-system-api/database'
import { registerAiNavigationCapability } from './capabilities/navigation.js'
import { registerAiActionDraftCapabilities } from './capabilities/action-drafts.js'
import { ActionDraftService } from './services/action-draft.service.js'

/**
 * AI 助手模块。独立于 demo 示例插件，可被产品 Manifest 单独安装或移除。
 *
 * 本模块不声明 config/ 菜单：入口是 Admin 右下角的全局悬浮宿主，不是左侧菜单项。
 * 权限 `ai:chat:use` 在 routes/v1/index.ts 中声明并由后端强制校验。
 */
const aiModule: ApiModule<SystemRuntime> = {
  contractVersion: 2,
  id: 'ai',
  name: 'AI 助手',
  version: '1.0.0',
  tablePrefix: 'ai_',
  dependencies: [{ id: 'system', version: '^2.0.0' }],
  migrations: { id: 'ai', folder: join(__dirname, 'drizzle'), historyTable: '__drizzle_migrations_ai' },
  async register(router) {
    await router.register(AutoLoad, { dir: join(__dirname, 'routes'), autoHooks: true, cascadeHooks: true })
  },
  async initialize(runtime) {
    // 能力注册在 initialize 而不是模块顶层：注册中心由 SystemRuntime 显式创建，
    // 顶层 import 时作用域还不存在。
    registerAiNavigationCapability()
    // 草稿能力绑定**当前执行环境**的草稿服务：它们写的是本模块自己的 ai_action_drafts 表，
    // 与 routes/v1/drafts.ts 用的是同一个 store 实现，因此界面看到的和助手存的是同一份草稿。
    registerAiActionDraftCapabilities({ drafts: ActionDraftService.forDatabase(drizzleDb) })
    // 核对依赖：本模块消费 system 域注册的能力，它们必须已经就位。
    const names = runtime.aiCapabilities.names
    for (const required of REQUIRED_CAPABILITIES) {
      if (!names.has(required)) throw new Error(`ai 模块依赖的能力 ${required} 未注册`)
    }
  },
}

/**
 * system 域应当开放的能力。缺一个就直接启动失败，而不是等到用户提问才报错。
 *
 * 草稿三件套由**本模块**注册（它们要写 ai_ 表），因此不在这份启动校验里；
 * `prepare_create_user` 也随它们一起从 system 域搬了过来，同名只此一份实现。
 */
const REQUIRED_CAPABILITIES = [
  'list_users', 'get_user', 'prepare_update_user', 'navigate_to_page',
  'get_user_create_form', 'get_user_create_options',
] as const

export default aiModule
