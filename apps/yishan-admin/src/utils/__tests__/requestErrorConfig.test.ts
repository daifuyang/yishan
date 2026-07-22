/**
 * Admin 请求错误处理：401 refresh 成功后的行为回归测试。
 *
 * 修复回归点：
 *  - refresh 成功后 **不能** 调 logout()、**不能** clearTokens()、
 *    **不能** history.replace(login)。
 *  - 必须把原请求以 skipErrorHandler 形式重放一遍，让服务端拿到最新 cookie
 *    走读路径、审计日志，并在 /auth/me 路径下回写 localStorage.currentUser。
 *  - refresh 失败或抛出异常时仍走 logout() 兜底。
 *
 * 由于 requestErrorConfig.ts 顶部的 import 链路会拉起
 *   - @umijs/max （实际是 .umi/plugin-request/request.ts，依赖 axios 实例）
 *   - antd message/notification
 *   - 本仓 services（依赖 .umi 产物）
 * 用 jest.mock 隔离掉这些模块，使 errorHandler 可在 JSDOM 下单独验证。
 */

const mockRequest = jest.fn();
const mockLogout = jest.fn();
const mockSetCurrentUser = jest.fn();
const mockClearTokens = jest.fn();
const mockRefreshToken = jest.fn();
const mockGetAuthorizationHeader = jest.fn();
const mockMessageSuccess = jest.fn();
const mockMessageError = jest.fn();

jest.mock('@umijs/max', () => ({
  __esModule: true,
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock('@/utils/auth', () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
  setCurrentUser: (...args: unknown[]) => mockSetCurrentUser(...args),
}));

jest.mock('@/utils/token', () => ({
  getAuthorizationHeader: (...args: unknown[]) => mockGetAuthorizationHeader(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
}));

jest.mock('@/services/generated/auth', () => ({
  refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
}));

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');
  return {
    ...antd,
    message: {
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: jest.fn(),
      info: jest.fn(),
    },
    notification: { open: jest.fn() },
  };
});

// 在 jest.mock 之后再导入被测模块，避免 hoist 把真实模块也拉起。
// __APP_BASE__ 由 jest.config.ts 的 globals 注入（jest 在 import 前就
// 把变量挂到 globalThis），无需在本文件再赋值。
import { errorConfig } from '@/requestErrorConfig';

const handler = (errorConfig.errorConfig as any).errorHandler as (
  error: any,
  opts: any,
) => Promise<void>;

// 把 globalThis.localStorage 显式替换为带 jest.fn() 的对象，便于断言 setItem 调用。
// tests/setupTests.jsx 已设置了一份 mock，但被测代码直接读 globalThis.localStorage，
// 此处再覆写一次确保类型是 jest.Mock。
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: localStorageMock,
});

beforeEach(() => {
  jest.clearAllMocks();
  // 默认让 refresh 成功
  mockRefreshToken.mockResolvedValue({
    success: true,
    data: { token: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 },
  });
  // 默认让重放请求成功
  mockRequest.mockResolvedValue({ success: true, data: { id: 1, username: 'admin' } });
  // logout 默认 resolve
  mockLogout.mockResolvedValue(undefined);
  // setCurrentUser 默认无副作用
  mockSetCurrentUser.mockImplementation(() => undefined);
});

describe('requestErrorConfig.errorHandler —— 401 refresh 流程', () => {
  it('refresh 成功后不调用 logout，不清 token，不跳登录页', async () => {
    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    // refresh 必须被触发
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    // 关键回归断言：refresh 成功后绝不能调 logout
    expect(mockLogout).not.toHaveBeenCalled();
    // 绝不能再 clearTokens
    expect(mockClearTokens).not.toHaveBeenCalled();
    // 提示用户「登录状态已刷新」
    expect(mockMessageSuccess).toHaveBeenCalledWith('登录状态已刷新');
  });

  it('refresh 成功后以 skipErrorHandler 把原请求重放一遍', async () => {
    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/admin/users', method: 'GET', params: { page: 1 } },
    );

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [url, opts] = mockRequest.mock.calls[0];
    expect(url).toBe('/api/v1/admin/users');
    expect(opts).toMatchObject({
      url: '/api/v1/admin/users',
      method: 'GET',
      params: { page: 1 },
      skipErrorHandler: true,
    });
  });

  it('refresh 成功后若原请求是 /auth/me，把最新用户回写到 setCurrentUser', async () => {
    const freshUser = {
      id: 7,
      username: 'fresh-admin',
      email: 'fresh@example.com',
      realName: 'Fresh Admin',
    };
    mockRequest.mockResolvedValue({ success: true, data: freshUser });

    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/auth/me', method: 'GET' },
    );

    // 走 utils/auth.setCurrentUser 统一封装，不再直接操作 localStorage。
    // 这样 logout() 与 /auth/me refresh 走的都是同一个 key，避免状态漂移。
    expect(mockSetCurrentUser).toHaveBeenCalledWith(freshUser);
  });

  it('refresh 成功后若 /auth/me 重放失败，不影响会话保留', async () => {
    mockRequest.mockRejectedValue(new Error('still 401'));

    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/auth/me', method: 'GET' },
    );

    // 重放失败不再做兜底登出
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it('refresh 失败时仍走 logout 兜底', async () => {
    mockRefreshToken.mockResolvedValue({ success: false });

    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/admin/orders', method: 'GET' },
    );

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('refresh 抛异常时仍走 logout 兜底', async () => {
    mockRefreshToken.mockRejectedValue(new Error('network down'));

    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/admin/orders', method: 'GET' },
    );

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('原请求本身就是 /auth/refresh 时（递归守卫），refresh 失败直接 logout', async () => {
    // 当 refresh 接口自己返回 401 时，必须立即登出避免无限循环。
    // 注意：守卫改为路径段匹配，refresh 端点的完整路径是
    //   /api/v1/auth/refresh
    // 任何业务路径里含子串 /auth/refresh 的端点都**不应**被误判登出。
    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/auth/refresh', method: 'POST' },
    );

    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('原请求 URL 含 /auth/refresh 子串但不是 refresh 端点时，应走 refresh 流程而非登出', async () => {
    // 反向回归：路径段匹配应该避免误判。
    // 例如 /api/v1/admin/auth/refresh-log 的旧版 includes 检查会被误判为 refresh。
    // 修复后只对精确路径 /api/v1/auth/refresh 触发守卫登出。
    // 这里构造的 URL 不等于 /api/v1/auth/refresh，期望走 refresh 路径。
    const url = '/api/v1/admin/auth/refresh-history'; // 子串含 /auth/refresh
    await handler({ response: { status: 401 } }, { url, method: 'GET' });

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('URL 带 query 时也能精确匹配 refresh 端点', async () => {
    await handler(
      { response: { status: 401 } },
      { url: '/api/v1/auth/refresh?foo=bar', method: 'POST' },
    );

    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('非 401 错误不会被 refresh 流程拦截', async () => {
    await handler(
      { response: { status: 500 } },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('skipErrorHandler: true 的请求不应进入错误处理（避免递归）', async () => {
    await expect(
      handler(
        { response: { status: 401 }, message: 'inner' },
        { url: '/api/v1/admin/users', method: 'GET', skipErrorHandler: true },
      ),
    ).rejects.toBeDefined();

    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});