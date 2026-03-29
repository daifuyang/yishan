import { Static, TSchema, Type } from '@sinclair/typebox'

const createSuccessResponseSchema = <T extends TSchema>(dataSchema: T) => Type.Object({
  code: Type.Number(),
  message: Type.String(),
  success: Type.Boolean(),
  data: dataSchema,
  timestamp: Type.String({ format: 'date-time' })
})

export const HelloHealthSchema = Type.Object({
  module: Type.String(),
  status: Type.String(),
  time: Type.String({ format: 'date-time' })
})

export const HelloCurrentUserSchema = Type.Object({
  userId: Type.Integer(),
  username: Type.String(),
  module: Type.String(),
  permission: Type.String()
})

export const HelloEchoBodySchema = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 200 })
})

export const HelloEchoResultSchema = Type.Object({
  echo: Type.String(),
  by: Type.String(),
  module: Type.String()
})

export const HelloHealthResponseSchema = createSuccessResponseSchema(HelloHealthSchema)
export const HelloCurrentUserResponseSchema = createSuccessResponseSchema(HelloCurrentUserSchema)
export const HelloEchoResponseSchema = createSuccessResponseSchema(HelloEchoResultSchema)

export type HelloEchoBody = Static<typeof HelloEchoBodySchema>
