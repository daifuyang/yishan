import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import type { SystemRuntime } from '@yishan/core-system-api'
import type { DemoUserProfiles } from './user-profile.repository'

export function registerDemoProfile(router: FastifyInstance, runtime: SystemRuntime, profiles: DemoUserProfiles) {
  createRouteRegistrar(router).get('/v1/me/profile', {
    access: { permission: { code: 'demo:profile:read', label: '示例用户业务资料', group: 'demo' } },
    schema: { tags: ['demo'], summary: '当前用户的 Demo 业务资料', operationId: 'demoUserProfile', response: {
      200: Type.Object({ success: Type.Boolean(), code: Type.Number(), message: Type.String(), timestamp: Type.String(), data: Type.Object({
        user: Type.Union([Type.Object({ id: Type.Number(), username: Type.Union([Type.String(), Type.Null()]), realName: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]),
        profile: Type.Union([Type.Object({ userId: Type.Number(), theme: Type.String(), lastEvent: Type.String(), updatedAt: Type.String() }), Type.Null()]),
      }) }),
    } },
  }, async (request, reply) => {
    const user = await runtime.users.findById(request.currentUser.id)
    const profile = await profiles.find(request.currentUser.id)
    return ResponseUtil.success(reply, { user, profile: profile ? { ...profile, updatedAt: profile.updatedAt.toISOString() } : null })
  })
}
