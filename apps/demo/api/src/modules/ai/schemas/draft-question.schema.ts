import { Type, type Static } from '@sinclair/typebox'

export const DraftQuestionSchema = Type.Object({
  questionId: Type.String(),
  draftId: Type.String(),
  draftVersion: Type.Integer({ minimum: 1 }),
  field: Type.String(),
  title: Type.String(),
  multiple: Type.Boolean(),
  allowEmpty: Type.Boolean(),
  truncated: Type.Boolean(),
  options: Type.Array(Type.Object({ value: Type.Number(), label: Type.String(), description: Type.Optional(Type.String()) })),
})
export const DraftQuestionQuerySchema = Type.Object({ conversationId: Type.String({ minLength: 1, maxLength: 64 }) }, { additionalProperties: false })
export const DraftQuestionAnswerSchema = Type.Object({
  ...DraftQuestionQuerySchema.properties,
  questionId: Type.String({ minLength: 1, maxLength: 200 }),
  draftVersion: Type.Integer({ minimum: 1 }),
  values: Type.Array(Type.Integer({ minimum: 1 }), { maxItems: 100, uniqueItems: true }),
}, { additionalProperties: false })
export const DraftQuestionListSchema = Type.Object({ questions: Type.Array(DraftQuestionSchema) })
export const DraftQuestionListResponseSchema = Type.Object({
  success: Type.Boolean(), code: Type.Number(), message: Type.String(), timestamp: Type.String(), data: DraftQuestionListSchema,
})
export type DraftQuestion = Static<typeof DraftQuestionSchema>
export type DraftQuestionAnswer = Static<typeof DraftQuestionAnswerSchema>
