# @yishan/core-app

Taro 应用的公共能力，属于 `packages/core/app`。产品拥有完整 App、页面、业务 API、路由跳转和配置；本包不导入任何产品。

公开入口：

| Export | 能力 | 产品注入 |
| --- | --- | --- |
| @yishan/core-app/request | 请求、分页、Token 注入、并发刷新、取消和会话失效 | baseUrl、storage、storageKeys、refreshPath |
| @yishan/core-app/auth | 独立 Zustand 登录状态、bootstrap、资料/权限恢复、登出 | API 方法、client、storage、keys、onUnauthorized |
| @yishan/core-app/storage | 跨端缓存包装 | StorageAdapter |
| @yishan/core-app/env | 不可变环境配置 | 环境模式、API Base URL |
| @yishan/core-app/hooks | useListPagination | 列表请求和权限条件 |
| @yishan/core-app/router | normalizePage | 页面路径 |
| @yishan/core-app/permissions | hasRequiredPermissions | 当前权限和所需权限 |

每个产品调用工厂创建自己的 request/store，不共享 Token、回调或 bootstrap flight。业务请求路径、用户模型、模块列表和导航不属于 Core。Session 的共同 TokenData/ApiResponse 是现有移动客户端协议，没有改变服务端契约。

这是私有 Source-First Workspace Package（private: true），不提供独立 npm 发布契约。Taro 使用官方 mini/h5 compile.include 编译公开 export 对应的源码；Webpack 保留 node_modules 默认查找，并优先解析消费应用的平台插件。React/Taro 是 peers，消费产品提供版本。本包不包含页面和 UI。

Taro 平台 API 在应用模块执行后初始化。产品的 storage adapter 应通过回调调用当前 Taro API，避免在初始化前捕获对象。参见 apps/demo/app/src/utils/storage.ts。

`pnpm --filter @yishan/core-app typecheck`、`build`、`test` 分别执行严格类型检查、声明/JS 构建和实例隔离测试。构建结果不提交，消费产品仍从公开源码 export 导入。

## 新产品装配契约

新建 apps/<product>/app 的独立 Taro 工程，产品自己配置 base URL、业务认证方法、用户模型、模块表、页面和导航；从公开 exports 消费 Core 和 @yishan/ui/mobile。依赖的 React/Taro 由产品提供。可参照 apps/demo/app/config 的官方 mini/h5 compile.include，不复制公共实现。

```ts
import { createApiClient } from "@yishan/core-app/request"
import { createAuthStore } from "@yishan/core-app/auth"
import { createStorage, createSessionStorageKeys } from "@yishan/core-app/storage"

const storageKeys = createSessionStorageKeys(productId)
const storage = createStorage(platformStorageAdapter)
const client = createApiClient({
  baseUrl: productApiBaseUrl, storage, storageKeys, refreshPath: productRefreshPath,
  // 可选：替换非 HTTP 401 的业务错误判定；HTTP 401 始终强制认证处理。
  isUnauthorized: (_status, body) => body?.code === productExpiredCode,
})
const auth = createAuthStore({
  client, storage, storageKeys, api: productAuthApi, onUnauthorized: navigateToLogin,
})
auth.setupAuthInterceptor()
```

以上值由产品组合入口提供；Core 不读取产品配置。每个 client 与 store 必须一一配对，setupAuthInterceptor 可重复调用而不会重复安装。默认认证错误码仍保持 Yishan 既有行为；普通业务错误不退出登录，刷新接口的网络连接失败保留凭据以便重试，明确拒绝凭据或无效刷新响应仍清理该实例。HTTP 401 不会因为自定义策略返回 false 而被放行。

productId 必须是非空小写标识，以字母开始，后续支持数字和单个连字符（例如 product-v2），拒绝空白、冒号、路径与重复连字符。工具返回只读 yishan:<productId>:accessToken / refreshToken / user。Demo 保留现有 yishan:app:*，本轮不迁移现有登录态；新产品使用自己的 ID。同源退出应调用 auth.useAuthStore.getState().clear()/logout()，它们只删除该产品的三项 Session key；storage.clear() 明确清空底层全部存储，不用于产品级登出。

功能模块配置与路由导航继续由产品维护；Core 仅接收已验证的 capabilities 与导航回调。取消、会话版本、refresh/bootstrap/identity flight 与回调均归各实例；过期请求不能覆盖新账号。测试使用两个真实 client/store 工厂与共享平台 Adapter，覆盖实例隔离和竞态，无需永久第二产品夹具。

## 工程验证

运行 pnpm check:taro 检查当前 Demo 及其共享包实际解析的 Taro/shim 版本，pnpm check:boundaries 检查公开导入与依赖方向。App checker 扫描 Core App/UI/TipTap 和 apps/<product>/app，支持字面量 TS/JS imports、import type、import()/require()/require.resolve() 与 Sass/CSS 导入，其他 API/Admin 由各自检查器负责。计算式参数、变量与插值不能由此静态检查解析，不声称覆盖所有动态依赖；源码别名仅识别当前 `@/`，任意自定义 tsconfig alias 需要另行审查。

构建：pnpm --filter @yishan/demo-app build:weapp / build:h5；新产品替换为自己的包名。Source-First 已在 Windows 的 Taro 4.2.0、React 18.3.1、Webpack 5.91.0 编译与 H5 浏览器验证；Linux GitHub CI 和微信真机必须另行验收，构建通过不替代设备验证。
