import { history, useModel } from '@umijs/max';
import {
  getBasePrefixFromPublicPath,
  stripBasePrefix,
} from '@yishan/core-admin/public-path';
import React, { useEffect, useState } from 'react';
import { useAiChat } from '../hooks/useAiChat';

/** 与后端 schemas/ai-chat.schema.ts 的 AI_PERMISSION.code 保持一致。 */
export const AI_USE_PERMISSION = 'ai:chat:use';

/** 公开页：未登录或不需要 AI 的场景，助手整体隐藏。 */
const PUBLIC_PATHS = ['/user/', '/q/'];

/**
 * 把当前登录身份与 AI 权限推进 Provider。
 *
 * 未登录、无权限或处于公开页时 identity 为 null，Provider 随即清空该用户的
 * 全部聊天状态并关闭助手，入口随之隐藏。后端仍独立校验同一权限码，
 * 前端隐藏不构成授权。
 */
export function AiChatIdentityBridge() {
  const { initialState } = useModel('@@initialState');
  // Umi's innerProvider has model context but is outside the router.
  const [location, setLocation] = useState(() => history.location);
  useEffect(
    () => history.listen(({ location: next }) => setLocation(next)),
    [],
  );
  const { setIdentity } = useAiChat();
  const user = initialState?.currentUser;
  const permissions = user?.permissions;
  const path = stripBasePrefix(
    location.pathname,
    getBasePrefixFromPublicPath(__APP_BASE__),
  );
  const allowed = Boolean(
    user &&
      (permissions?.includes(AI_USE_PERMISSION) ||
        permissions?.includes('*')) &&
      !PUBLIC_PATHS.some((prefix) => path.startsWith(prefix)),
  );
  const identity = allowed ? String(user?.id) : null;
  useEffect(() => {
    setIdentity(identity);
  }, [identity, setIdentity]);
  return null;
}
