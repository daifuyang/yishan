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

这是源码 Workspace Package。Taro 使用官方 mini/h5 compile.include 编译公开 export 对应的源码；Webpack 保留 node_modules 默认查找，并优先解析消费应用的平台插件。React/Taro 是 peers，消费产品提供版本。本包不包含页面和 UI。

Taro 平台 API 在应用模块执行后初始化。产品的 storage adapter 应通过回调调用当前 Taro API，避免在初始化前捕获对象。参见 apps/yishan-app/src/utils/storage.ts。

`pnpm --filter @yishan/core-app typecheck`、`build`、`test` 分别执行严格类型检查、声明/JS 构建和实例隔离测试。构建结果不提交，消费产品仍从公开源码 export 导入。
