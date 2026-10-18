import { describe, expect, it } from 'vitest'
import { isOffTopic, matchDirectIntent, OFF_TOPIC_REPLY } from '../services/ai-intent-router.js'
import { NAVIGATE_TARGETS, navigateToPage, NavigateInputSchema } from '../capabilities/navigation.js'
import { Value } from '@sinclair/typebox/value'

const ALL = new Set(['list_users', 'list_roles', 'list_departments', 'navigate_to_page'])

describe('AI intent router', () => {
  it('routes a short list question straight to the capability without a model call', () => {
    expect(matchDirectIntent('有哪些用户', ALL)).toEqual({ capability: 'list_users', input: {} })
    expect(matchDirectIntent('部门列表', ALL)).toEqual({ capability: 'list_departments', input: {} })
    expect(matchDirectIntent('有哪些角色？', ALL)).toEqual({ capability: 'list_roles', input: {} })
  })

  it('routes an explicit navigation request through the whitelist', () => {
    expect(matchDirectIntent('打开用户管理', ALL)).toEqual({ capability: 'navigate_to_page', input: { target: 'user_list' } })
  })

  it('never routes a capability the caller cannot execute', () => {
    expect(matchDirectIntent('有哪些用户', new Set(['list_roles']))).toBeNull()
  })

  it('leaves real business questions to the model', () => {
    for (const text of ['帮我查一下张伟属于哪个部门', '把研发部新同事的账号信息准备好']) {
      expect(matchDirectIntent(text, ALL)).toBeNull()
      expect(isOffTopic(text)).toBe(false)
    }
  })

  /**
   * 手填的创建请求必须走模型 + 草稿，绝不能落到规则直答。
   *
   * 直答分支没有草稿：它只能回答一次无状态调用，于是「好的，已创建」这句话在那一层
   * 是可以被说出来的。这里逐句钉住这条规则的业务措辞范围，正则宽了就多锁一句，
   * 窄了就漏掉一种用户会打出来的说法。
   */
  it('never routes a hand-typed create request to the direct-answer branch', () => {
    const EVERYTHING = new Set(['list_users', 'list_roles', 'list_departments', 'navigate_to_page', 'prepare_create_user', 'get_user_create_form'])
    for (const text of [
      '新建一个用户叫张三',
      '创建一个账号',
      '新增用户',
      '加一个成员 李四',
      '帮我建个用户吧',
      '我确认了，直接创建',
    ]) {
      expect(matchDirectIntent(text, EVERYTHING), text).toBeNull()
      // 也不能被当成闲聊：它必须真的进模型，而不是被一句固定回绝打发掉。
      expect(isOffTopic(text), text).toBe(false)
    }
  })

  it('still routes the plain list questions that share the same words', () => {
    expect(matchDirectIntent('有哪些用户', ALL)).toEqual({ capability: 'list_users', input: {} })
    expect(matchDirectIntent('用户列表', ALL)).toEqual({ capability: 'list_users', input: {} })
  })

  it('refuses obvious off-topic chatter', () => {
    expect(isOffTopic('你好')).toBe(true)
    expect(isOffTopic('写首诗')).toBe(true)
    expect(isOffTopic('你是谁')).toBe(true)
  })

  it('does not mistake an empty message for chatter', () => {
    expect(isOffTopic('   ')).toBe(false)
  })

  it('answers chatter with a fixed line, never with a model call', () => {
    expect(OFF_TOPIC_REPLY).toContain('业务助手')
    expect(OFF_TOPIC_REPLY.length).toBeLessThan(120)
  })
})

describe('navigate_to_page whitelist', () => {
  it('maps every target to an explicit route', () => {
    for (const [key, target] of Object.entries(NAVIGATE_TARGETS)) {
      expect(target.path.startsWith('/system/')).toBe(true)
      expect(Value.Check(NavigateInputSchema, { target: key })).toBe(true)
    }
  })

  it('refuses an arbitrary URL the model might invent', async () => {
    // 输入 schema 只接受白名单键，任意 path 连类型校验都过不了。
    expect(Value.Check(NavigateInputSchema, { target: '/etc/passwd' })).toBe(false)
    expect(Value.Check(NavigateInputSchema, { target: 'https://evil.example.com' })).toBe(false)
    expect(Value.Check(NavigateInputSchema, { path: '/system/user' })).toBe(false)
  })

  it('resolves only whitelisted targets at execution time', async () => {
    const context = { actorId: 1, permissions: new Set<string>(), requestId: 'r' }
    const result = await navigateToPage.execute(context, { target: 'department_list' })
    expect(result.render).toEqual({ kind: 'navigate', payload: { target: 'department_list', path: '/system/department', label: '部门管理' } })
    await expect(navigateToPage.execute(context, { target: 'secret_admin' })).rejects.toThrow('不支持的跳转目标')
  })
})
