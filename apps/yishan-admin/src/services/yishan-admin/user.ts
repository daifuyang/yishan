// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

export interface UpdateMyProfileBody {
  nickname?: string;
  realName?: string;
  email?: string;
  gender?: '0' | '1' | '2';
  birthDate?: string;
}

/** 更新当前用户资料 更新当前登录用户的昵称/姓名/邮箱/性别/出生日期等可编辑字段 PUT /api/v1/app/users/me */
export async function updateMyProfile(
  body: UpdateMyProfileBody,
  options?: { [key: string]: any },
) {
  return request<API.currentUserResp>('/api/v1/app/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data: body,
    ...(options || {}),
  });
}
