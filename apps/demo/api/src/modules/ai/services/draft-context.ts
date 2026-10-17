/**
 * draft-context.ts — 把**本会话当前的草稿**注入模型上下文。
 *
 * 没有它，模型只能读历史里的工具结果：用户说「手机号改成 138…」之后，历史里躺着三份
 * 互相矛盾的旧摘要，模型要么追问已经问过的问题，要么把上一轮的缺失项当成现在还缺。
 * 当前状态必须**每轮重新计算并注入**，而不是指望模型在长历史里保持一致。
 *
 * 三条约束：
 *
 * - **非敏感**：草稿里本来就只有非敏感字段（密码类字段写不进去），这里再过一次白名单，
 *   让「读」这条路径也说不出敏感值。
 * - **瞬时**：不进对话、不落库。它是每轮重新计算的快照，存进历史只会变成第四份会过期的真相。
 * - **状态优先于文本**：草稿一旦取消或完成，注入的仍然是它「结束」的事实，
 *   因此迟到的工具结果无法通过上下文把模型劝回一条已经结束的收集流程。
 */
import { USER_CREATE_DRAFT_FIELD_KEYS } from '@yishan/core-system-api'
import type { ActionDraftRecord } from '../repositories/action-draft.repository.js'

const ALLOWED = new Set<string>(USER_CREATE_DRAFT_FIELD_KEYS)

/** 只保留仍在进行中的草稿：已取消/完成/过期的没有继续收集的意义。 */
const OPEN_STATUSES = new Set(['collecting', 'ready', 'previewing', 'failed'])

function renderDraft(draft: ActionDraftRecord): string {
  const collected = Object.entries(draft.formData)
    .filter(([key, value]) => ALLOWED.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join('；')
  const askable = draft.missingFields.filter(field => !field.mustCompleteInForm).map(field => field.label)
  const inForm = draft.missingFields.filter(field => field.mustCompleteInForm).map(field => field.label)
  const problems = draft.validationErrors.map(error => `${error.label}：${error.message}`)
  const lines = [
    `草稿 ${draft.draftId}（${draft.module}/${draft.action}，版本 ${draft.draftVersion}，状态 ${draft.status}）`,
    `已收集：${collected || '（暂无）'}`,
    `仍需向用户询问：${askable.join('、') || '（无）'}`,
    `必须由用户在表单中填写：${inForm.join('、') || '（无）'}`,
    problems.length ? `需要更正：${problems.join('；')}` : '需要更正：（无）',
  ]
  return lines.map(line => `- ${line}`).join('\n')
}

/**
 * 生成注入模型的草稿上下文；没有可用草稿时返回空串（调用方不应拼出空标题）。
 *
 * 只取**最新一份**可继续的草稿：同时注入多份会让模型面对互相冲突的版本号，
 * 而选哪一份本身就是一个不该由模型做的决定。
 */
export function buildDraftContext(drafts: readonly ActionDraftRecord[]): string {
  const open = drafts.filter(draft => OPEN_STATUSES.has(draft.status))
  const latest = open.at(-1)
  if (!latest) return ''
  return [
    '本会话当前的表单草稿（以下为服务器真实状态，优先于历史里的旧工具结果）：',
    renderDraft(latest),
    '不要重复询问「仍需向用户询问」以外已经收集的字段；用户接下来的话只会更新这份草稿。',
    '你不能提交表单：用户必须在原生表单里核对并点击保存。',
  ].join('\n')
}
