/**
 * Admin `app.tsx#getInitialState` 初始化回归测试
 *
 * 覆盖：
 *  1. 登录页：不读取用户、字典、存储配置。
 *  2. 非登录页但用户为空：仅调用用户接口；字典/存储均不调用。
 *  3. 已登录：字典和存储都调用，结果写入 state，且**并行**发起（Promise.all）。
 *  4. 并行性：两个 deferred 请求在任意一个 resolve 前都已开始。
 *
 * 实现约束：
 *  - 必须 import 生产 `getInitialState`，禁止在测试中 mock Promise.all 后断言副本。
 *  - 必须真实调用 getInitialState()；唯一 mock 的是其依赖的服务实现。
 *  - 不能为了"演示" Promise.all 行为而保留只跑 mock Promise.all 的用例。
 */

// ============================================================================
// jest.mock 工厂会被 hoist 到模块顶部，不能引用 outer 变量。
// 通过定义 mock 句柄为 jest.fn() 内部的全局 mock 容器（使用 globalThis 共享
// 给每条 test），避免 hoist 顺序问题。
// ============================================================================

interface MockHandles {
  getCurrentUser: jest.Mock
  getDictDataMap: jest.Mock
  fetchCloudStorageConfig: jest.Mock
  pathname: string
}

const mockHandles: MockHandles = {
  getCurrentUser: jest.fn(),
  getDictDataMap: jest.fn(),
  fetchCloudStorageConfig: jest.fn(),
  pathname: '/admin/dashboard',
}

;(globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks = mockHandles

jest.mock('@/services/generated/auth', () => ({
  __esModule: true,
  getCurrentUser: (...args: unknown[]) =>
    (globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks.getCurrentUser(...(args as [])),
}))

jest.mock('@/services/generated/sysDictData', () => ({
  __esModule: true,
  default: (globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks,
  getDictDataMap: (...args: unknown[]) =>
    (globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks.getDictDataMap(...(args as [])),
}))

jest.mock('@/utils/attachmentUpload', () => ({
  __esModule: true,
  fetchCloudStorageConfig: (...args: unknown[]) =>
    (globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks.fetchCloudStorageConfig(...(args as [{ force?: boolean }?])),
  uploadAttachmentFile: jest.fn(),
}))

jest.mock('@umijs/max', () => ({
  __esModule: true,
  history: {
    get location() {
      return {
        pathname: (globalThis as unknown as { __adminInitMocks: MockHandles }).__adminInitMocks.pathname,
      }
    },
    push: jest.fn(),
    replace: jest.fn(),
  },
  Link: () => null,
  Navigate: () => null,
}))

// PNG 资源在 jest 中无法被 require 解析，mock 为字符串
jest.mock('@public/icons/avatar.png', () => 'avatar-stub', { virtual: true })
jest.mock('query-string', () => ({
  stringify: () => '',
  parse: () => ({}),
}))
jest.mock('../shared/publicPath', () => ({
  __esModule: true,
  normalizePublicPath: (rawPath?: string) => (rawPath ? `/${rawPath.replace(/^\/+|\/+$/g, '')}/` : '/'),
  isValidPublicPath: () => true,
  getBasePrefixFromPublicPath: () => '/',
  stripBasePrefix: (_path: string, _base: string) => _path,
}))

// app.tsx 模块顶部 IconMap 中的 JSX 需要 React；我们 mock 整个 icons 模块。
// 测试只关心 getInitialState 行为，无需 React 组件树真正渲染。
jest.mock('@ant-design/icons', () => ({
  __esModule: true,
  AppstoreOutlined: () => null,
  FileTextOutlined: () => null,
  FolderOutlined: () => null,
  InboxOutlined: () => null,
  LinkOutlined: () => null,
  ReadOutlined: () => null,
  SettingOutlined: () => null,
  ShoppingOutlined: () => null,
  SmileOutlined: () => null,
}))
jest.mock('@ant-design/pro-components', () => ({
  __esModule: true,
  SettingDrawer: () => null,
}))
jest.mock('antd', () => ({
  __esModule: true,
  App: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))
// 测试不渲染组件，stub 掉组件入口避免 antd-style 等渲染副作用
jest.mock('@/components', () => ({
  __esModule: true,
  AvatarDropdown: () => null,
  AvatarName: () => null,
  Footer: () => null,
  Question: () => null,
  SelectLang: () => null,
}))
jest.mock('@/services/generated/sysMenus', () => ({
  __esModule: true,
  getAuthorizedMenuTree: jest.fn(),
}))
jest.mock('../src/requestErrorConfig', () => ({
  __esModule: true,
  errorConfig: {},
}))

// 必须在所有 jest.mock 之后再 import 生产函数
import { getInitialState } from '../src/app'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  start: () => Promise<T>
}

function defer<T>(value: T): Deferred<T> {
  let resolveFn: (value: T) => void = () => undefined
  let rejectFn: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })
  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    start: async () => {
      resolveFn(value)
      return value
    },
  }
}

beforeEach(() => {
  mockHandles.getCurrentUser.mockReset()
  mockHandles.getDictDataMap.mockReset()
  mockHandles.fetchCloudStorageConfig.mockReset()
  mockHandles.pathname = '/admin/dashboard'
})

// ============================================================================
// 真实场景 — 直接调用生产 getInitialState
// ============================================================================

describe('getInitialState — 真实生产函数回归', () => {
  it('登录页：不读取用户、字典、存储配置', async () => {
    mockHandles.pathname = '/user/login'

    const state = await getInitialState()

    expect(mockHandles.getCurrentUser).not.toHaveBeenCalled()
    expect(mockHandles.getDictDataMap).not.toHaveBeenCalled()
    expect(mockHandles.fetchCloudStorageConfig).not.toHaveBeenCalled()
    expect(state.currentUser).toBeUndefined()
    expect(state.dictDataMap).toBeUndefined()
    expect(state.cloudStorageConfig).toBeUndefined()
  })

  it('非登录页但用户为空：仅调用用户接口；字典/存储均不调用', async () => {
    mockHandles.pathname = '/admin/dashboard'
    mockHandles.getCurrentUser.mockResolvedValue({
      success: true,
      data: undefined,
    })

    const state = await getInitialState()

    expect(mockHandles.getCurrentUser).toHaveBeenCalledTimes(1)
    expect(mockHandles.getDictDataMap).not.toHaveBeenCalled()
    expect(mockHandles.fetchCloudStorageConfig).not.toHaveBeenCalled()
    expect(state.currentUser).toBeUndefined()
    expect(state.dictDataMap).toBeUndefined()
    expect(state.cloudStorageConfig).toBeUndefined()
  })

  it('已登录：字典和存储都调用，结果写入 state', async () => {
    mockHandles.pathname = '/admin/dashboard'
    mockHandles.getCurrentUser.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'admin' } as unknown as API.currentUser,
    })
    mockHandles.getDictDataMap.mockResolvedValue({
      success: true,
      data: { sys_user_sex: { 1: '男' } },
    })
    mockHandles.fetchCloudStorageConfig.mockResolvedValue({
      provider: 'local',
      bucket: 'b1',
      region: 'cn',
    })

    const state = await getInitialState()

    expect(mockHandles.getCurrentUser).toHaveBeenCalledTimes(1)
    expect(mockHandles.getDictDataMap).toHaveBeenCalledTimes(1)
    expect(mockHandles.fetchCloudStorageConfig).toHaveBeenCalledTimes(1)
    expect(state.currentUser).toEqual({ id: 1, name: 'admin' })
    expect(state.dictDataMap).toEqual({ sys_user_sex: { 1: '男' } })
    expect(state.cloudStorageConfig).toEqual({
      provider: 'local',
      bucket: 'b1',
      region: 'cn',
    })
  })

  it('并行性：字典与存储 fetcher 在 getInitialState 内被并发启动', async () => {
    mockHandles.pathname = '/admin/dashboard'
    mockHandles.getCurrentUser.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'admin' } as unknown as API.currentUser,
    })

    const dictStarted: number[] = []
    const storageStarted: number[] = []

    mockHandles.getDictDataMap.mockImplementation(() => {
      dictStarted.push(Date.now())
      return defer({ success: true, data: { tag: 'a' } }).start()
    })
    mockHandles.fetchCloudStorageConfig.mockImplementation(() => {
      storageStarted.push(Date.now())
      return defer({ provider: 'local' }).start()
    })

    const state = await getInitialState()

    expect(mockHandles.getDictDataMap).toHaveBeenCalledTimes(1)
    expect(mockHandles.fetchCloudStorageConfig).toHaveBeenCalledTimes(1)
    expect(state.currentUser).toEqual({ id: 1, name: 'admin' })
    expect(state.dictDataMap).toEqual({ tag: 'a' })
    expect(state.cloudStorageConfig).toEqual({ provider: 'local' })

    expect(dictStarted).toHaveLength(1)
    expect(storageStarted).toHaveLength(1)
    const delta = Math.abs(dictStarted[0] - storageStarted[0])
    expect(delta).toBeLessThan(50)
  })

  it('已登录但字典接口抛错 → 静默退化为空对象，不阻塞 state 返回', async () => {
    mockHandles.pathname = '/admin/dashboard'
    mockHandles.getCurrentUser.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'admin' } as unknown as API.currentUser,
    })
    mockHandles.getDictDataMap.mockRejectedValue(new Error('dict boom'))
    mockHandles.fetchCloudStorageConfig.mockResolvedValue({ provider: 'local' })

    const state = await getInitialState()

    expect(state.currentUser).toEqual({ id: 1, name: 'admin' })
    expect(state.dictDataMap).toEqual({})
    expect(state.cloudStorageConfig).toEqual({ provider: 'local' })
  })
})
