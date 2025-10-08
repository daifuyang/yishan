/**
 * 认证相关工具函数
 * 处理用户登录状态管理、注销等功能
 */

import { history } from '@umijs/max';
import { message } from 'antd';
import { clearTokens, isLoggedIn } from './token';
import { postAuthLogout } from '@/services/yishan-admin/sysAuth';

/**
 * 用户注销
 */
export const logout = async (redirectToLogin = true) => {
  try {
    // 调用后端注销接口
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await postAuthLogout({ refreshToken });
    }
  } catch (error) {
    console.error('注销失败:', error);
    // 即使后端注销失败，也继续本地清理
  } finally {
    // 清除本地存储的token和用户信息
    clearTokens();
    
    // 清除用户信息缓存
    localStorage.removeItem('currentUser');
    
    if (redirectToLogin) {
      message.success('已安全退出');
      
      // 跳转到登录页面，并记录当前页面用于重定向
      const currentPath = window.location.pathname + window.location.search;
      history.push(`/user/login?redirect=${encodeURIComponent(currentPath)}`);
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