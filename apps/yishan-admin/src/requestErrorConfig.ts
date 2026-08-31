import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { request } from '@umijs/max';
import { message, notification } from 'antd';
import { authRefreshToken as apiRefreshToken } from '@/services/generated/auth';
import { logout, setCurrentUser } from '@/utils/auth';
import { clearTokens, getAuthorizationHeader } from '@/utils/token';

// 401 refresh 单飞锁：多个并发 401 共享同一次 /auth/refresh 调用。
// 当前为 CSR 模块级单实例，足够覆盖单页签内的并发刷新。
// refreshToken 现由 HttpOnly cookie（yishan_rt）自动携带，前端无需读取/传入。
type RefreshResult = { ok: true; data: any } | { ok: false; error: unknown };

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
        return {
          ok: false as const,
          error: new Error('refresh response not success'),
        };
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

/**
 * 登录类接口的路径白名单。这些端点返回的 401 是**业务级 401**
 * （用户名/密码错误、账号被禁用/锁定等），必须走 envelope 展示
 * 后端 message，不能误走 refresh token 流程。
 *
 * 注意：保持精确匹配（路径段相等），避免将来出现含 `/auth/login` 子串的
 * 路径（例如 `/api/v1/admin/auth/login-logs`）被误判。
 */
const AUTH_LOGIN_PATHS: ReadonlySet<string> = new Set([
  '/api/v1/auth/login',
  '/api/v1/app/auth/login',
]);

function isAuthLoginEndpoint(requestPath: string): boolean {
  return AUTH_LOGIN_PATHS.has(requestPath);
}

/**
 * 业务 401 的兜底处理：access token 过期时尝试用 refresh token 续命。
 *
 * 仅当请求不是登录类接口时调用（登录 401 在 caller 里被 isAuthLoginEndpoint 短路）。
 * refresh 成功后：
 *   - 用新 cookie 静默重放原请求，让服务端审计/读路径拿到最新数据；
 *   - /auth/me 路径额外把最新用户回写到 localStorage。
 * refresh 失败/抛异常：清本地 token + 强制登出。
 */
async function handleUnauthorizedRefresh(opts: any): Promise<void> {
  try {
    const result = await refreshOnce();

    if (result.ok) {
      message.success('登录状态已刷新');

      try {
        const retryResp = await request(opts.url, {
          ...opts,
          skipErrorHandler: true,
        });
        if (
          typeof opts?.url === 'string' &&
          opts.url.includes('/auth/me') &&
          (retryResp as any)?.success &&
          (retryResp as any)?.data
        ) {
          try {
            // 走 setCurrentUser 统一封装，避免直接操作 localStorage；
            // logout() 也通过同一个 key 清理，保证状态同步。
            setCurrentUser((retryResp as any).data);
          } catch {
            // localStorage 写入失败不影响会话保留
          }
        }
      } catch {
        // 重放失败不再做兜底登出；用户下一次主动操作会用新 cookie 成功
      }
    } else {
      console.error('Token刷新失败:', result.error);
      clearTokens();
      await logout();
    }
  } catch (refreshError) {
    console.error('Token刷新失败:', refreshError);
    clearTokens();
    await logout();
  }
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
 * 后端信封（`{ success, code, message, data, timestamp }`）在 HTTP 4xx/5xx 上
 * 同样会返回。此时 umi 的 errorThrower 不会被触发（响应走 axios 的 reject 分支），
 * 错误处理只能拿到 error.response。若一律按 HTTP status 套固定文案，后端已经写
 * 清楚的业务提示（如「password:长度不能少于 6 位」）就被「请求参数错误」覆盖掉。
 *
 * 下面两个纯函数分别负责：
 *   1. 判断响应体是否是可信的失败信封（对象 + success === false + 非空 message）；
 *   2. 按业务码区间决定提示等级，而不是特判某个具体码。
 */

/** 业务码区间：参数/校验类错误。与后端 constants/business-codes/validation.ts 的 21xxx 对齐。 */
const VALIDATION_CODE_MIN = 21000;
const VALIDATION_CODE_MAX = 22000;

/**
 * 从 axios 错误响应体里取出可信的业务 message。
 *
 * 只信任「对象形态 + success === false + message 是非空字符串」的响应；
 * 其余（HTML 错误页、网关纯文本、字段缺失的畸形 JSON）一律返回 null，
 * 由调用方回退到按 HTTP status 的既有文案。
 */
export function pickEnvelopeMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const envelope = body as { success?: unknown; message?: unknown };
  if (envelope.success !== false) return null;
  if (typeof envelope.message !== 'string') return null;
  const trimmed = envelope.message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 决定提示等级。
 *
 * 规则按业务码区间划分，不针对单个码特判：
 *   - 21xxx（参数/校验类，用户改一下输入就能过）→ warning，不用红色打断；
 *   - 其余（系统错误、认证、业务冲突、码缺失或非法）→ error。
 */
export function resolveMessageLevel(code: unknown): 'warning' | 'error' {
  if (typeof code !== 'number' || !Number.isFinite(code)) return 'error';
  return code >= VALIDATION_CODE_MIN && code < VALIDATION_CODE_MAX
    ? 'warning'
    : 'error';
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
        const error: any = new Error(responseMessage || '业务处理失败');
        error.name = 'BizError';
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
        // 用 URL 路径段匹配，避免未来出现路径中含 "/auth/refresh" 子串的
        // 端点被误判。query string 在 .split('?')[0] 时已经去掉。
        const requestPath = (opts?.url ?? '').split('?')[0];
        if (requestPath === '/api/v1/auth/refresh') {
          // refresh 端点本身 401（refresh token 也过期/无效）：强制登出，
          // 不会再走 refresh 流程造成递归。
          await logout();
          return;
        }

        // 登录类接口（用户名/邮箱 + 密码登录）返回的 401 是**业务级 401**，
        // 后端会带统一信封 `{success:false, code:22007/..., message:'用户名或密码错误'}`。
        // 这种 401 **绝对不能** 走 refresh token 流程：
        //   1. 调 /auth/refresh 也会 401，又会触发上面的 logout 守卫把未登录会话清掉；
        //   2. 后端写的友好 message（"用户名或密码错误" / "账号已被禁用"等）会被吞掉，
        //      用户只能看到兜底文案，体感像是"系统坏了"。
        // 因此登录接口的 401 直接跳出 401 块，由下方 envelope 逻辑展示后端 message。
        if (isAuthLoginEndpoint(requestPath)) {
          // fallthrough 到下方的 envelope / 403 / BizError 分支
        } else {
          await handleUnauthorizedRefresh(opts);
          return;
        }
      }

      // 处理403权限错误
      if (error.response?.status === 403) {
        message.error('权限不足，无法访问此资源');
        return;
      }

      // 我们的 errorThrower 抛出的错误。
      if (error.name === 'BizError') {
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
        // Axios 的错误。
        // 后端在 4xx/5xx 上仍返回统一信封，errorThrower 拿不到它（走 reject 分支），
        // 所以这里优先展示信封里的业务 message，取不到才回退按 status 的固定文案。
        // 文案原则：
        //   1. 避免「异常」「请求错误」这种生硬措辞；
        //   2. 系统级错误（5xx）提示「暂时无法访问，请稍后再试」，把细节留给日志。
        const status = error.response.status;
        const envelopeMessage = pickEnvelopeMessage(error.response.data);
        let errorMessage =
          envelopeMessage ?? `操作失败，请稍后再试（${status}）`;

        if (!envelopeMessage) {
          switch (status) {
            case 400:
              errorMessage = '提交的内容有误，请检查后重试';
              break;
            case 404:
              errorMessage = '找不到相关内容，可能已被删除';
              break;
            case 500:
              errorMessage = '服务暂时无法处理，请稍后再试';
              break;
            case 502:
              errorMessage = '服务暂时无法连接，请稍后再试';
              break;
            case 503:
              errorMessage = '服务正在维护中，请稍后再试';
              break;
            default:
              errorMessage = `操作失败，请稍后再试（${status}）`;
          }
        }

        // 只有信封可信时才按业务码分级；回退文案一律 error，保持既有行为。
        const level = envelopeMessage
          ? resolveMessageLevel(
              (error.response.data as { code?: unknown })?.code,
            )
          : 'error';
        message[level](errorMessage);
      } else if (error.request) {
        // 网络层失败（请求发出去但没收到响应）
        message.error('网络好像不太通畅，请检查连接后重试');
      } else {
        // 发送请求前就出错（请求还没真正发出去）
        message.error('操作没成功，请稍后再试');
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
        console.warn('获取授权头失败:', error);
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
