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
const mockMessageWarning = jest.fn();

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
  authRefreshToken: (...args: unknown[]) => mockRefreshToken(...args),
}));

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');
  return {
    ...antd,
    message: {
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
      info: jest.fn(),
    },
    notification: { open: jest.fn() },
  };
});

// 在 jest.mock 之后再导入被测模块，避免 hoist 把真实模块也拉起。
// __APP_BASE__ 由 jest.config.ts 的 globals 注入（jest 在 import 前就
// 把变量挂到 globalThis），无需在本文件再赋值。
import {
  errorConfig,
  pickEnvelopeMessage,
  resolveMessageLevel,
} from '@/requestErrorConfig';

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

/**
 * 后端在 4xx/5xx 上仍返回统一信封 `{success,code,message,...}`，但此时 umi 的
 * errorThrower 不会触发（走 axios reject 分支），错误处理只能看到 error.response。
 * 这里验证：可信信封优先展示后端 message，不可信则回退到既有的按 status 固定文案。
 */
describe('pickEnvelopeMessage —— 只信任可信的失败信封', () => {
  it('success === false 且 message 非空时取出 message', () => {
    expect(
      pickEnvelopeMessage({
        success: false,
        code: 21006,
        message: 'password:长度不能少于 6 位',
      }),
    ).toBe('password:长度不能少于 6 位');
  });

  it('message 前后有空白时 trim', () => {
    expect(
      pickEnvelopeMessage({ success: false, code: 21001, message: '  参数错误  ' }),
    ).toBe('参数错误');
  });

  it('success 不是 false 时不取（避免误读成功信封）', () => {
    expect(pickEnvelopeMessage({ success: true, message: 'ok' })).toBeNull();
    expect(pickEnvelopeMessage({ message: '没有 success 字段' })).toBeNull();
  });

  it('message 缺失、空串、纯空白、非字符串时不取', () => {
    expect(pickEnvelopeMessage({ success: false, code: 21001 })).toBeNull();
    expect(pickEnvelopeMessage({ success: false, message: '' })).toBeNull();
    expect(pickEnvelopeMessage({ success: false, message: '   ' })).toBeNull();
    expect(pickEnvelopeMessage({ success: false, message: 123 })).toBeNull();
  });

  it('非对象响应体（HTML 错误页 / 网关纯文本 / null）不取', () => {
    expect(pickEnvelopeMessage('<html>502 Bad Gateway</html>')).toBeNull();
    expect(pickEnvelopeMessage(null)).toBeNull();
    expect(pickEnvelopeMessage(undefined)).toBeNull();
  });
});
describe('resolveMessageLevel —— 按业务码区间分级，不特判单个码', () => {
  it('21xxx 参数/校验类整段都是 warning', () => {
    // 断言的是「整个 21xxx 段」而不是某个魔法码
    expect(resolveMessageLevel(21000)).toBe('warning');
    expect(resolveMessageLevel(21001)).toBe('warning');
    expect(resolveMessageLevel(21006)).toBe('warning');
    expect(resolveMessageLevel(21999)).toBe('warning');
  });

  it('区间外的业务码是 error', () => {
    expect(resolveMessageLevel(20000)).toBe('error'); // 系统错误
    expect(resolveMessageLevel(22000)).toBe('error'); // 上边界为开区间
    expect(resolveMessageLevel(22001)).toBe('error'); // 认证
    expect(resolveMessageLevel(30001)).toBe('error'); // 业务
  });

  it('码缺失或非法时保守用 error', () => {
    expect(resolveMessageLevel(undefined)).toBe('error');
    expect(resolveMessageLevel(null)).toBe('error');
    expect(resolveMessageLevel('21001')).toBe('error');
    expect(resolveMessageLevel(Number.NaN)).toBe('error');
  });
});
describe('requestErrorConfig.errorHandler —— HTTP 错误分支的文案与等级', () => {
  it('400 带有效信封：展示后端 message，21xxx 用 warning', async () => {
    await handler(
      {
        response: {
          status: 400,
          data: {
            success: false,
            code: 21006,
            message: 'password:长度不能少于 6 位',
          },
        },
      },
      { url: '/api/v1/admin/users', method: 'POST' },
    );

    expect(mockMessageWarning).toHaveBeenCalledWith('password:长度不能少于 6 位');
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('400 带有效信封但业务码在 21xxx 之外：仍展示 message，等级为 error', async () => {
    await handler(
      {
        response: {
          status: 400,
          data: { success: false, code: 30001, message: '该用户已存在' },
        },
      },
      { url: '/api/v1/admin/users', method: 'POST' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('该用户已存在');
    expect(mockMessageWarning).not.toHaveBeenCalled();
  });

  it('400 无信封：保持既有固定文案且用 error', async () => {
    await handler(
      { response: { status: 400, data: '<html>Bad Request</html>' } },
      { url: '/api/v1/admin/users', method: 'POST' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('请求参数错误');
    expect(mockMessageWarning).not.toHaveBeenCalled();
  });

  it('500 带信封：展示后端 message（系统码走 error）', async () => {
    await handler(
      {
        response: {
          status: 500,
          data: { success: false, code: 20001, message: '数据库连接失败' },
        },
      },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('数据库连接失败');
  });

  it('500 无信封：回退到「服务器内部错误」', async () => {
    await handler(
      { response: { status: 500, data: undefined } },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('服务器内部错误');
  });

  it('404 无信封：回退到「请求的资源不存在」', async () => {
    await handler(
      { response: { status: 404, data: null } },
      { url: '/x', method: 'GET' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('请求的资源不存在');
  });

  it('502 / 503 / 未枚举 status 的回退文案不变', async () => {
    await handler(
      { response: { status: 502, data: null } },
      { url: '/x', method: 'GET' },
    );
    expect(mockMessageError).toHaveBeenCalledWith('网关错误');

    mockMessageError.mockClear();
    await handler(
      { response: { status: 503, data: null } },
      { url: '/x', method: 'GET' },
    );
    expect(mockMessageError).toHaveBeenCalledWith('服务暂时不可用');

    mockMessageError.mockClear();
    await handler(
      { response: { status: 418, data: null } },
      { url: '/x', method: 'GET' },
    );
    expect(mockMessageError).toHaveBeenCalledWith('请求错误 418');
  });

  it('网络错误（有 request 无 response）不受信封逻辑影响', async () => {
    await handler(
      { request: {} },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('网络错误，请检查网络连接');
    expect(mockMessageWarning).not.toHaveBeenCalled();
  });

  it('既无 response 也无 request 时走最后兜底', async () => {
    await handler({}, { url: '/api/v1/admin/users', method: 'GET' });

    expect(mockMessageError).toHaveBeenCalledWith('请求错误，请重试');
  });

  it('403 仍由专门分支处理，不进入信封逻辑', async () => {
    await handler(
      {
        response: {
          status: 403,
          data: { success: false, code: 22003, message: '后端说没权限' },
        },
      },
      { url: '/api/v1/admin/users', method: 'GET' },
    );

    // 403 分支在信封逻辑之前 return，保持既有行为
    expect(mockMessageError).toHaveBeenCalledWith('权限不足，无法访问此资源');
  });

  it('BizError（errorThrower 抛出的）分支不受影响', async () => {
    await handler(
      {
        name: 'BizError',
        info: { errorCode: 21001, errorMessage: '业务校验失败', showType: 2 },
      },
      { url: '/api/v1/admin/users', method: 'POST' },
    );

    expect(mockMessageError).toHaveBeenCalledWith('业务校验失败');
  });
});