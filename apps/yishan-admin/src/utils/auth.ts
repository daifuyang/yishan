/**
 * 认证相关工具函数
 * 处理用户登录状态管理、注销等功能
 */

import { history } from '@umijs/max';
import { message } from 'antd';
import { clearTokens, isLoggedIn } from './token';
import { logout as apiLogout } from '@/services/yishan-admin/auth';

const ADMIN_BASE = (process.env.PUBLIC_PATH || '/admin/').replace(/\/+$/, '');
const LOGIN_PATH = '/user/login';

const normalizePath = (pathname: string) => {
  if (pathname.startsWith(ADMIN_BASE)) {
    return pathname.slice(ADMIN_BASE.length) || '/';
  }
  return pathname;
};

const resolveSafeRedirectTarget = (target: string | null) => {
  if (!target) return '/';
  try {
    const parsed = new URL(target, window.location.origin);
    const normalized = normalizePath(parsed.pathname);
    if (normalized === LOGIN_PATH) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return '/';
  }
};

/**
 * 用户注销
 */
export const logout = async (redirectToLogin = true) => {
  try {
    if (isLoggedIn()) {
      const res = await apiLogout();
      if(res.success) {
        message.success(res.message || '注销成功');
      }
    }
  } catch {
    // 即使后端注销失败，也继续本地清理
  } finally {
    // 清除本地存储的token和用户信息
    clearTokens();
    // 清除用户信息缓存
    localStorage.removeItem('currentUser');
    if (redirectToLogin) {
      const urlSearch = window.location.search;
      const params = new URLSearchParams(urlSearch);
      const redirectParam = params.get('redirect');
      const isLogin = normalizePath(window.location.pathname) === LOGIN_PATH;
      const currentTarget = `${window.location.pathname}${urlSearch}`;
      const target = isLogin
        ? resolveSafeRedirectTarget(redirectParam)
        : resolveSafeRedirectTarget(currentTarget);
      history.push(`${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`);
    }
  }
};

/**
 * 检查用户是否需要登录
 */
export const checkAuth = (): boolean => {
  return isLoggedIn();
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('解析用户信息失败:', error);
      return null;
    }
  }
  return null;
};

/**
 * 保存当前用户信息
 */
export const setCurrentUser = (user: any) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

/**
 * 清除当前用户信息
 */
export const clearCurrentUser = () => {
  localStorage.removeItem('currentUser');
};
