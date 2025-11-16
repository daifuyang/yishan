/**
 * 认证相关工具函数
 * 处理用户登录状态管理、注销等功能
 */

import { history } from '@umijs/max';
import { message } from 'antd';
import { clearTokens, isLoggedIn } from './token';
import { logout as apiLogout } from '@/services/yishan-admin/auth';

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
  } catch (error) {
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
      const isLogin = window.location.pathname.startsWith('/user/login');
      const target = isLogin ? (redirectParam || '/') : window.location.pathname + urlSearch;
      history.push(`/user/login?redirect=${encodeURIComponent(target)}`);
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