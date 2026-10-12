/**
 * 首页常用应用的 TypeBox Schema。只携带工作台入口 ID，名称图标仍以授权菜单树为准。
 */

import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { successResponse } from "./common.js";

const MenuIdSchema = Type.Integer({ minimum: 1, description: "工作台入口ID" });

const AppHomeAppsSchema = Type.Object(
  {
    pinned: Type.Array(MenuIdSchema, { description: "用户固定的入口，按用户排序" }),
    ranked: Type.Array(MenuIdSchema, { description: "其余已授权入口，按使用习惯排序；无记录时按工作台顺序" }),
  },
  { $id: "appHomeApps" }
);

const AppHomeAppsRespSchema = successResponse({
  data: Type.Ref("appHomeApps"),
  $id: "appHomeAppsResp",
  message: "获取常用应用成功",
});

const SaveAppHomePinsReqSchema = Type.Object(
  {
    menuIds: Type.Array(MenuIdSchema, { maxItems: 8, description: "固定的入口，按显示顺序；空数组表示全部取消" }),
  },
  { $id: "saveAppHomePinsReq" }
);

const ReportAppUsageReqSchema = Type.Object({ menuId: MenuIdSchema }, { $id: "reportAppUsageReq" });

const ReportAppUsageRespSchema = successResponse({
  data: Type.Object({ recorded: Type.Boolean({ description: "是否计入（入口不可用时为 false）" }) }),
  $id: "reportAppUsageResp",
  message: "已记录",
});

const registerAppHome = (fastify: FastifyInstance) => {
  fastify.addSchema(AppHomeAppsSchema);
  fastify.addSchema(AppHomeAppsRespSchema);
  fastify.addSchema(SaveAppHomePinsReqSchema);
  fastify.addSchema(ReportAppUsageReqSchema);
  fastify.addSchema(ReportAppUsageRespSchema);
};

export default registerAppHome;
