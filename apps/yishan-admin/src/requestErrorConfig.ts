import type { RequestOptions } from "@@/plugin-request/request";
import type { RequestConfig } from "@umijs/max";
import { message, notification } from "antd";
import { logout } from "@/utils/auth";
import {
  getAuthorizationHeader,
  isRefreshTokenExpired,
  clearTokens,
} from "@/utils/token";
import { postAuthRefresh } from "@/services/yishan-admin/sysAuth";

// 错误处理方案： 错误类型
enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}
// 与后端约定的响应数据格式
interface ResponseStructure {
  success?: boolean;
  code?: number; // 兼容格式：使用code代替success+errorCode
  message?: string; // 兼容格式：使用message代替errorMessage
  data: any;
  errorCode?: number; // 标准格式
  errorMessage?: string; // 标准格式
  showType?: ErrorShowType;
}

/**
 * @name 错误处理
 * pro 自带的错误处理， 可以在这里做自己的改动
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理： umi@3 的错误处理方案。
  errorConfig: {
    // 错误抛出
    errorThrower: (res) => {
      const {
        success,
        code,
        message,
        data,
        errorCode,
        errorMessage,
        showType,
      } = res as unknown as ResponseStructure;

      // 兼容处理：支持两种响应格式
      const responseCode = code || errorCode;
      const responseMessage = message || errorMessage;
      const isSuccess =
        success !== undefined
          ? success
          : responseCode && responseCode.toString().startsWith("200");

      if (!isSuccess) {
        const error: any = new Error(responseMessage || "业务处理失败");
        error.name = "BizError";
        error.info = {
          errorCode: responseCode,
          errorMessage: responseMessage,
          showType,
          data,
        };
        throw error; // 抛出自制的错误
      }
    },
    // 错误接收及处理
    errorHandler: async (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;

      // 处理401未授权错误 - 尝试自动刷新token
      if (error.response?.status === 401) {
        // 跳过刷新token的请求，避免无限循环
        if (opts?.url?.includes("/auth/refresh")) {
          await logout();
          return;
        }

        try {
          // 检查refresh token是否有效
          if (isRefreshTokenExpired()) {
            await logout();
            return;
          }

          // 尝试刷新token
          const refreshToken = localStorage.getItem("refreshToken");
          if (!refreshToken) {
            await logout();
            return;
          }

          const refreshResponse = await postAuthRefresh({ refreshToken });

          if (
            refreshResponse.code?.toString().startsWith("200") &&
            refreshResponse.data
          ) {
            // 保存新的token
            const {
              accessToken,
              refreshToken: newRefreshToken,
              accessTokenExpiresIn,
              refreshTokenExpiresIn,
            } = refreshResponse.data;

            // 使用统一的token管理工具保存新token
            const now = Math.floor(Date.now() / 1000);
            localStorage.setItem("accessToken", accessToken);
            localStorage.setItem("refreshToken", newRefreshToken);
            localStorage.setItem(
              "accessTokenExpiry",
              String(now + (accessTokenExpiresIn || 900))
            );
            localStorage.setItem(
              "refreshTokenExpiry",
              String(now + (refreshTokenExpiresIn || 604800))
            );

            message.success("登录状态已刷新");

            window.location.reload();
          } else {
            // 刷新失败，清除token并登出
            clearTokens();
            await logout();
          }
        } catch (refreshError) {
          console.error("Token刷新失败:", refreshError);
          clearTokens();
          await logout();
        }
        return;
      }

      // 处理403权限错误
      if (error.response?.status === 403) {
        message.error("权限不足，无法访问此资源");
        return;
      }

      // 我们的 errorThrower 抛出的错误。
      if (error.name === "BizError") {
        const errorInfo: ResponseStructure | undefined = error.info;
        if (errorInfo) {
          const { errorMessage, errorCode } = errorInfo;
          switch (errorInfo.showType) {
            case ErrorShowType.SILENT:
              // do nothing
              break;
            case ErrorShowType.WARN_MESSAGE:
              message.warning(errorMessage);
              break;
            case ErrorShowType.ERROR_MESSAGE:
              message.error(errorMessage);
              break;
            case ErrorShowType.NOTIFICATION:
              notification.open({
                description: errorMessage,
                message: errorCode,
              });
              break;
            case ErrorShowType.REDIRECT:
              // TODO: redirect
              break;
            default:
              message.error(errorMessage);
          }
        }
      } else if (error.response) {
        // Axios 的错误
        const status = error.response.status;
        let errorMessage = `请求错误 ${status}`;

        switch (status) {
          case 400:
            errorMessage = "请求参数错误";
            break;
          case 404:
            errorMessage = "请求的资源不存在";
            break;
          case 500:
            errorMessage = "服务器内部错误";
            break;
          case 502:
            errorMessage = "网关错误";
            break;
          case 503:
            errorMessage = "服务暂时不可用";
            break;
          default:
            errorMessage = `请求错误 ${status}`;
        }

        message.error(errorMessage);
      } else if (error.request) {
        // 网络错误
        message.error("网络错误，请检查网络连接");
      } else {
        // 发送请求时出了点问题
        message.error("请求错误，请重试");
      }
    },
  },

  // 请求拦截器
  requestInterceptors: [
    (config: RequestOptions) => {
      // 使用token管理工具获取token
      try {
        const authHeader = getAuthorizationHeader();

        if (authHeader) {
          return {
            ...config,
            headers: {
              ...config.headers,
              Authorization: authHeader,
            },
          };
        }
      } catch (error) {
        // 忽略token获取错误，继续请求
        console.warn("获取授权头失败:", error);
      }
      return config;
    },
  ],

  // 响应拦截器
  responseInterceptors: [
    async (response) => {
      return response;
    },
  ],
};
