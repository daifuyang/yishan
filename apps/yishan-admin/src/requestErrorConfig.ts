import type { RequestOptions } from "@@/plugin-request/request";
import type { RequestConfig } from "@umijs/max";
import { request } from "@umijs/max";
import { message, notification } from "antd";
import { logout } from "@/utils/auth";
import {
  getAuthorizationHeader,
  clearTokens,
} from "@/utils/token";
import { refreshToken as apiRefreshToken } from "@/services/generated/auth";

// 401 refresh 单飞锁：多个并发 401 共享同一次 /auth/refresh 调用。
// 当前为 CSR 模块级单实例，足够覆盖单页签内的并发刷新。
// refreshToken 现由 HttpOnly cookie（yishan_rt）自动携带，前端无需读取/传入。
type RefreshResult =
  | { ok: true; data: any }
  | { ok: false; error: unknown };

let refreshInFlight: Promise<RefreshResult> | null = null;

async function refreshOnce(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // 后端从 HttpOnly cookie 读取 refreshToken，body 无需携带；
        // skipErrorHandler 避免刷新失败时触发全局 401 处理递归。
        const resp = await apiRefreshToken({}, { skipErrorHandler: true });
        if (resp?.success === true && resp.data) {
          return { ok: true as const, data: resp.data };
        }
        return { ok: false as const, error: new Error("refresh response not success") };
      } catch (err) {
        return { ok: false as const, error: err };
      } finally {
        // 等当前 microtask 上所有 await 消费完结果再清空，避免下一波 401
        // 立刻触发新的 /auth/refresh 请求。
        queueMicrotask(() => {
          refreshInFlight = null;
        });
      }
    })();
  }
  return refreshInFlight;
}

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
      const isSuccess = success === true;

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
        // 跳过刷新token的请求，避免无限循环。
        // 注意：用 URL 路径段匹配而非 includes，避免未来出现路径中含
        // "/auth/refresh" 子串的端点被误判。
        const requestPath = (opts?.url ?? "").split("?")[0];
        if (requestPath === "/api/v1/auth/refresh") {
          await logout();
          return;
        }

        try {
          // 尝试刷新 token —— refreshToken 由 HttpOnly cookie 自动携带，
          // 刷新成功后后端会通过 Set-Cookie 写入新的令牌。
          const result = await refreshOnce();

          if (result.ok) {
            message.success("登录状态已刷新");

            // 刷新成功 ≠ 登出。新 cookie 已由后端 Set-Cookie 写入，浏览器会
            // 自动带上。我们重新发起原请求作为副作用——既能让服务端读路径/审计
            // 拿到最新数据，也能在 /auth/me 这种路径上把最新用户信息同步到
            // localStorage，让 utils/auth:getCurrentUser() 读到的不是过期值。
            //
            // 架构约束：@umijs/max 的 request 插件在 apps/yishan-admin/src/.umi/
            // plugin-request/request.ts 的 .catch 分支里始终对原 Promise reject，
            // 因此 errorHandler 的返回值无法回填给原 caller，原 Promise 仍然 401。
            // 这是 umi-request 老版与新版 request 插件的契约差异，本期不做插件替换，
            // 接受原 caller 收到 401，但确保会话保留 + 重放副作用 + 不再跳登录页。
            try {
              const retryResp = await request(opts.url, {
                ...opts,
                skipErrorHandler: true,
              });
              if (
                typeof opts?.url === "string" &&
                opts.url.includes("/auth/me") &&
                (retryResp as any)?.success &&
                (retryResp as any)?.data
              ) {
                try {
                  localStorage.setItem(
                    "currentUser",
                    JSON.stringify((retryResp as any).data),
                  );
                } catch {
                  // localStorage 写入失败不影响会话保留
                }
              }
            } catch {
              // 重放失败不再做兜底登出；用户下一次主动操作会用新 cookie 成功
            }
          } else {
            console.error("Token刷新失败:", result.error);
            // 刷新失败，清除本地残留并登出
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
