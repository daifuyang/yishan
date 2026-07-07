import { Static, Type } from "@sinclair/typebox";

const DashboardStatsSchema = Type.Object({
  userTotal: Type.Integer({ minimum: 0, description: '用户总数' }),
  deptTotal: Type.Integer({ minimum: 0, description: '部门总数' }),
  todayLogin: Type.Integer({ minimum: 0, description: '今日登录次数' }),
  online: Type.Integer({ minimum: 0, description: '在线用户数' }),
});

export type DashboardStats = Static<typeof DashboardStatsSchema>;

export const DashboardStatsRespSchema = Type.Object({
  code: Type.Number({ example: 10000 }),
  message: Type.String({ example: '操作成功' }),
  success: Type.Boolean({ example: true }),
  data: DashboardStatsSchema,
  timestamp: Type.String({ format: 'date-time' }),
}, { $id: 'DashboardStatsResp' });
