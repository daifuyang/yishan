import { Type, type Static } from '@sinclair/typebox'

/**
 * 工作台 HTTP schema。
 */

export const DashboardCountersSchema = Type.Object({
  myCustomers: Type.Number(),
  pendingFollowUp: Type.Number(),
  todayNew: Type.Number(),
  publicPool: Type.Number(),
  weekFollowUps: Type.Number(),
  monthNew: Type.Number(),
})
export type DashboardCounters = Static<typeof DashboardCountersSchema>

export const DashboardPendingCustomerSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  statusName: Type.Union([Type.String(), Type.Null()]),
})
export type DashboardPendingCustomer = Static<typeof DashboardPendingCustomerSchema>

export const DashboardActivitySchema = Type.Object({
  id: Type.Number(),
  type: Type.String(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.Number(),
  customerName: Type.String(),
  occurredAt: Type.String({ format: 'date-time' }),
  summary: Type.String(),
})
export type DashboardActivity = Static<typeof DashboardActivitySchema>

export const DashboardRespSchema = Type.Object({
  counters: DashboardCountersSchema,
  pendingFollowUps: Type.Array(DashboardPendingCustomerSchema),
  recentActivities: Type.Array(DashboardActivitySchema),
})
export type DashboardResp = Static<typeof DashboardRespSchema>
