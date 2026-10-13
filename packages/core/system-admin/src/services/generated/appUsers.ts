// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 更新当前用户资料 移动端更新当前登录用户的昵称/真实姓名/邮箱/性别/出生日期/手机号/头像等可编辑字段 PUT /api/v1/app/users/me */
export async function appUpdateMe(
  body: {
    nickname?: string;
    realName?: string;
    email?: string;
    gender?: "0" | "1" | "2";
    birthDate?: string;
    phone?: string;
    avatar?: string;
  },
  options?: { [key: string]: any }
) {
  return request<SystemAPI.userDetailResp>("/api/v1/app/users/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 我的登录日志 分页获取当前用户的登录日志 GET /api/v1/app/users/me/login-logs */
export async function appGetMyLoginLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.appGetMyLoginLogsParams,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.sysLoginLogListResp>(
    "/api/v1/app/users/me/login-logs",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        // pageSize has a default value: 10
        pageSize: "10",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 我的登录日志详情 根据日志ID获取当前用户的单条登录日志详情（越权与不存在均返回 LOGIN_LOG_NOT_FOUND） GET /api/v1/app/users/me/login-logs/${param0} */
export async function appGetMyLoginLog(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.appGetMyLoginLogParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<SystemAPI.sysLoginLogDetailResp>(
    `/api/v1/app/users/me/login-logs/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 修改当前用户密码 需要传入旧密码与新密码，旧密码校验通过后写入新密码并撤销所有 token PUT /api/v1/app/users/me/password */
export async function appChangeMyPassword(
  body: {
    oldPassword: string;
    newPassword: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
  }>("/api/v1/app/users/me/password", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
