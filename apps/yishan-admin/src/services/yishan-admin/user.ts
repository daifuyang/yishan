import { request } from '@umijs/max';

export interface UpdateMyProfileBody { nickname?: string; realName?: string; email?: string; gender?: '0' | '1' | '2'; birthDate?: string; }
export async function updateMyProfile(body: UpdateMyProfileBody, options?: { [key: string]: any }) { return request<API.currentUserResp>('/api/v1/app/users/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, data: body, ...(options || {}) }); }
