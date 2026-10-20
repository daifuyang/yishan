import type { ActionDraft, ActionDraftService } from './action-draft.service.js'
import { authorizeDraft, draftAdapter } from './draft-forms.js'
import { EDITABLE_ACTION_DRAFT_STATUSES } from '../schemas/action-draft.schema.js'
import type { DraftQuestionAnswer } from '../schemas/draft-question.schema.js'
import { aiError } from '../ai-chat-error.js'

interface Subject { actorId: number; tokenScope?: readonly string[] }
interface QuestionDefinition {
  field: string
  title: string
  multiple: boolean
  options: readonly { value: number; label: string; description?: string }[]
  allowEmpty?: boolean
  truncated?: boolean
}
type QuestionProvider = (subject: Subject, draft: ActionDraft, fields: Record<string, unknown>) => Promise<readonly QuestionDefinition[]>

/** Questions select real business candidates; answering can only patch a versioned draft. */
export class DraftQuestionService {
  constructor(
    private readonly drafts: Pick<ActionDraftService, 'get' | 'patch'>,
    private readonly provide: QuestionProvider = async (subject, draft, fields) => {
      const adapter = draftAdapter(draft.action)
      await authorizeDraft(draft.action, subject, draft.formData)
      if (draft.schemaVersion !== adapter.form().schemaVersion) throw aiError(409, '表单定义已更新，请重新准备草稿')
      return await adapter.questions?.(subject, fields) ?? []
    },
  ) {}

  private async own(subject: Subject, conversationId: string, draftId: string) {
    const draft = await this.drafts.get(subject.actorId, draftId)
    if (draft.conversationId !== conversationId) throw aiError(404, '草稿不存在')
    if (!EDITABLE_ACTION_DRAFT_STATUSES.includes(draft.status)) throw aiError(409, '草稿已结束，请重新开始')
    return draft
  }

  async list(subject: Subject, conversationId: string, draftId: string) {
    const draft = await this.own(subject, conversationId, draftId)
    const definitions = await this.provide(subject, draft, draft.formData)
    return { questions: definitions.map(question => ({
      ...question,
      questionId: `${draft.draftId}:${draft.draftVersion}:${question.field}`,
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
      allowEmpty: question.allowEmpty ?? false,
      truncated: question.truncated ?? false,
    })) }
  }

  async answer(subject: Subject, draftId: string, input: DraftQuestionAnswer): Promise<ActionDraft> {
    const draft = await this.own(subject, input.conversationId, draftId)
    const prefix = `${draftId}:${input.draftVersion}:`
    if (!input.questionId.startsWith(prefix)) throw aiError(409, '问题已更新，请重新选择')
    const field = input.questionId.slice(prefix.length)
    const replay = draft.draftVersion === input.draftVersion + 1
    if (!replay && draft.draftVersion !== input.draftVersion) throw aiError(409, '草稿版本已更新，请重新选择')
    // Replay must still recheck current authorization and candidate availability.
    const fields = { ...draft.formData }
    if (replay) delete fields[field]
    const definitions = await this.provide(subject, draft, fields)
    const question = definitions.find(item => item.field === field)
    if (!question) throw aiError(409, '问题已更新，请重新选择')
    const allowed = new Set(question.options.map(item => item.value))
    if (!Array.isArray(input.values) || new Set(input.values).size !== input.values.length ||
      input.values.some(value => !Number.isSafeInteger(value) || !allowed.has(value)) ||
      (!question.allowEmpty && !input.values.length) || (!question.multiple && input.values.length > 1)) {
      throw aiError(400, '请选择当前可用的候选项')
    }
    const value = question.multiple ? input.values : input.values[0] ?? null
    if (replay) {
      if (JSON.stringify(draft.formData[field] ?? null) !== JSON.stringify(value)) throw aiError(409, '草稿版本已更新，请重新选择')
      return draft
    }
    return this.drafts.patch(subject.actorId, draftId, input.draftVersion, { [field]: value }, { subject })
  }
}
