/**
 * auth-provider.ts — system 默认的 AuthProvider 实现（契约见 core/auth/identity.ts）。
 *
 *   - 会话：sys_user_token 中存在且未撤销的 access / refresh token → sys_user
 *   - PAT：sys_api_token（明文哈希匹配、未过期、未撤销）→ sys_user，并异步记录最近使用
 *   - 权限：用户角色 → sys_role_permission；super_admin 角色追加超管哨兵
 *   - 用户状态："0" 禁用、"2" 锁定 → 拒绝
 *
 * 组合根 app.ts 把它装饰为 `fastify.authProvider`。替换身份体系时在 app.ts 换成自己的实现，
 * 并删除下方对 CurrentUser 的声明合并。
 */
import type { AuthProvider, CurrentUser } from "../auth/identity.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { UserErrorCode } from "../../constants/business-codes/user.js";
import { UserTokenRepository } from "../repositories/user-token.repository.js";
import { ApiTokenRepository } from "../repositories/api-token.repository.js";
import { UserService } from "./user.service.js";
import { PermissionService } from "./permission.service.js";
import type { SysUserResp } from "../schemas/user.js";

declare module "../auth/identity.js" {
  // 默认实现下 request.currentUser 是完整的 sys_user 视图。
  interface CurrentUser extends SysUserResp {}
}

/** 检查用户状态（禁用 / 锁定）。失败时抛 BusinessError。 */
function ensureUserAccessible(user: SysUserResp): void {
  if (user.status === "0") {
    throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用，无法访问。");
  }
  if (user.status === "2") {
    throw new BusinessError(AuthErrorCode.ACCOUNT_LOCKED, "账号已被锁定，请联系管理员。");
  }
}

export const defaultAuthProvider: AuthProvider = {
  async resolveSession({ token, kind }) {
    const record = kind === "refresh_token"
      ? await UserTokenRepository.findByRefreshToken(token)
      : await UserTokenRepository.findByAccessToken(token);
    if (!record) return null;

    const user = await UserService.getUserById(record.userId);
    if (!user) {
      throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "当前用户不存在，请联系管理员处理。");
    }
    ensureUserAccessible(user);
    return user as CurrentUser;
  },

  async resolveApiToken({ token, ip, log }) {
    const apiToken = await ApiTokenRepository.findByRawToken(token);
    if (!apiToken) return null;

    const user = await UserService.getUserById(apiToken.userId);
    if (!user) {
      throw new BusinessError(AuthErrorCode.API_TOKEN_REVOKED, "API Token 关联用户不存在或已不可用。");
    }
    if (user.status === "0" || user.status === "2") {
      throw new BusinessError(AuthErrorCode.API_TOKEN_REVOKED, "API Token 关联用户已被禁用或锁定。");
    }

    setImmediate(() => {
      ApiTokenRepository.touch(apiToken.id, ip).catch((err) => {
        log.warn({ err, apiTokenId: apiToken.id }, "Failed to update API token last-used metadata");
      });
    });
    return { user: user as CurrentUser, scopes: apiToken.scopes ?? [] };
  },

  async loadPermissions(user) {
    const { perms } = await PermissionService.loadForRoleIds(user.roleIds ?? []);
    return perms;
  },
};
