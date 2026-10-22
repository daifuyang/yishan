import { history, useModel } from '@umijs/max';
import {
  getBasePrefixFromPublicPath,
  stripBasePrefix,
} from '@yishan/core-admin/public-path';
import React, { useEffect, useState } from 'react';
import { aiRuntimeConfigGet } from '@/services/generated/ai';
import { AI_USE_PERMISSION } from '../constants';
import { useAiChat } from '../hooks/useAiChat';

export { AI_USE_PERMISSION };

/** 公开页：未登录或不需要 AI 的场景，助手整体隐藏。 */
const PUBLIC_PATHS = ['/user/', '/q/'];

/**
 * 把当前登录身份与 AI 权限推进 Provider。
 *
 * 未登录、无权限、处于公开页，或管理员在 AI 设置里关掉了总开关时，
 * identity 为 null，Provider 随即清空该用户的全部聊天状态并关闭助手，
 * 悬浮入口、浮窗、全屏工作区以及表单里的补全面板一起消失。后端仍独立
 * 校验同一权限码与开关状态，前端隐藏不构成授权。
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
  // 总开关未知时先当关着：宁可晚一次出现，也不要先冒出个打不通的浮窗。
  // 依赖里带 path 是有意的：管理员在设置页拨完开关，下一次跳转就该看到浮窗
  // 消失/出现，而不是要刷新整页。一个只回布尔值的 GET，换来开关即时生效。
  const [enabled, setEnabled] = useState(false);
  const path = stripBasePrefix(
    location.pathname,
    getBasePrefixFromPublicPath(__APP_BASE__),
  );
  const permitted = Boolean(
    user &&
      (permissions?.includes(AI_USE_PERMISSION) ||
        permissions?.includes('*')) &&
      !PUBLIC_PATHS.some((prefix) => path.startsWith(prefix)),
  );
  useEffect(() => {
    if (!permitted) return;
    let active = true;
    void aiRuntimeConfigGet()
      .then((response) => {
        if (active) setEnabled(Boolean(response.data?.enabled));
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [permitted, path]);
  const allowed = permitted && enabled;
  const identity = allowed ? String(user?.id) : null;
  useEffect(() => {
    setIdentity(identity);
  }, [identity, setIdentity]);
  return null;
}
