/**
 * ai-intent-router.ts — 规则层，排在模型之前。
 *
 * 目的有两个，都是成本与边界问题：
 * 1. **高频短指令不进模型**：「有哪些用户」直接调 `list_users`，省掉一整轮
 *    输入 token 与一次模型往返，答案还更准（规则不会把「张伟」重述成「张伟先生」）。
 * 2. **明显与业务无关的输入不进模型**：闲聊一旦进了模型，就已经在为它付费，
 *    而且模型可能顺口答出一个业务操作建议。固定文本直接回绝。
 *
 * 边界（必须诚实说明）：
 * - 规则只覆盖**短而明确**的指令。判定不确定的一律放行给模型——宁可多花一次
 *   调用，也不要用规则把真实业务问题误判成闲聊。
 * - 闲聊识别是**关键词级**的启发式，不是语义判定。它拦得住「写首诗」，
 *   拦不住「你觉得今天怎么样」。真正的语义边界由系统提示词承担，
 *   这里是省钱的粗筛，不是安全边界。
 */

export interface DirectIntent {
  readonly capability: string
  readonly input: Record<string, unknown>
}

interface Rule {
  readonly capability: string
  readonly pattern: RegExp
  readonly build?: (match: RegExpMatchArray) => Record<string, unknown>
}

/** 打开某张列表页的显式说法。命中即跳过模型。 */
const NAVIGATE_RULES: Rule[] = [
  { capability: 'navigate_to_page', pattern: /(?:打开|跳转到?|进入|去看)\s*(?:用户管理)/, build: () => ({ target: 'user_list' }) },
  { capability: 'navigate_to_page', pattern: /(?:打开|跳转到?|进入|去看)\s*(?:角色管理)/, build: () => ({ target: 'role_list' }) },
  { capability: 'navigate_to_page', pattern: /(?:打开|跳转到?|进入|去看)\s*(?:部门管理)/, build: () => ({ target: 'department_list' }) },
]

const QUERY_RULES: Rule[] = [
  { capability: 'list_departments', pattern: /^(?:有)?(?:哪些|多少个?)?(?:部门|组织|组)(?:列表|清单)?[?？。!！]?$/ },
  { capability: 'list_roles', pattern: /^(?:有)?(?:哪些|多少个?)?(?:角色|权限组)(?:列表|清单)?[?？。!！]?$/ },
  { capability: 'list_users', pattern: /^(?:有)?(?:哪些|多少个?)?(?:用户|账号|成员)(?:列表|清单)?[?？。!！]?$/ },
]

const RULES = [...NAVIGATE_RULES, ...QUERY_RULES]

/**
 * 「要新建/创建某个业务对象」的请求，**永远**不进规则直答分支。
 *
 * 理由不是省钱而是多轮：这类请求需要读表单定义、读候选、把每一轮的增量存进草稿，
 * 而规则分支只能做一次无状态调用。更要紧的是，直答分支的回复里没有草稿——
 * 一句「好的，已创建」在这里是可以被说出来的。因此这类输入一律放行给模型，
 * 让它走「追问 + 草稿」这条唯一的收集路径。
 *
 * 「直接创建」「我确认了」也落进这个判定：它们是创建意图，不是授权。
 */
const NATIVE_FORM_REQUEST = /(?:新建|创建|新增|添加|录入|建一个|加一个|建个|加个)[^。！？!?\n]{0,12}?(?:用户|账号|帐号|成员|职员)/

export function isNativeFormRequest(text: string): boolean {
  return NATIVE_FORM_REQUEST.test(text.trim())
}

/**
 * 命中一条规则就直接进能力。`available` 只含当前用户有权执行的能力——
 * 无权的能力不会因为命中规则而被调用（执行链还会再拒一次，但提示清单先收窄）。
 */
export function matchDirectIntent(text: string, available: ReadonlySet<string>): DirectIntent | null {
  const normalized = text.trim()
  if (!normalized || normalized.length > 40) return null
  // 创建意图不进直答：直答没有草稿，也就无法收集、更无法被用户核对。
  if (isNativeFormRequest(normalized)) return null
  for (const rule of RULES) {
    if (!available.has(rule.capability)) continue
    const match = normalized.match(rule.pattern)
    if (!match) continue
    return { capability: rule.capability, input: rule.build?.(match) ?? {} }
  }
  return null
}

/** 与业务无关的固定回绝文本。措辞本身要说明边界，而不是假装没听懂。 */
export const OFF_TOPIC_REPLY = '我是移山系统的业务助手，只处理系统内的事：查用户 / 角色 / 部门、预填新增表单、跳转管理页面。其他问题我帮不上忙。'

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /^(?:你好|您好|hi|hello|在吗|嗨)[!！。?？\s]*$/i,
  /(?:写|来)(?:一)?(?:首|篇|段)(?:诗|文案|小说|情话|段子)/,
  /(?:讲|说)(?:个|一个)(?:笑话|段子)/,
  /(?:你是谁|你叫什么|你是什么模型)/,
  /(?:帮我|给我)(?:写|编)(?:代码|程序|脚本|函数)/,
]

export function isOffTopic(text: string): boolean {
  const normalized = text.trim()
  if (!normalized || normalized.length > 60) return false
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(normalized))
}
