# 全局响应状态码规范文档

## 概述

本项目采用**业务码 + HTTP状态码**的双重状态码体系设计，通过标准化的响应格式提供精确的业务状态描述和良好的前后端协作体验。

## 核心设计原则

### 1. 双重状态码分离
- **业务码 (Business Code)**: 5位数字，精确描述具体业务场景
- **HTTP状态码**: 标准HTTP协议状态码，保持协议兼容性

### 2. 业务码编码规则

#### 2.1 编码结构
```
第1位：业务模块标识
├─ 1: 系统模块
├─ 2: 用户模块  
├─ 3: 订单模块
├─ 4: 商品模块
├─ 5: 支付模块
└─ 9: 通用模块

第2-3位：业务功能标识
第4-5位：具体状态标识
```

#### 2.2 状态码范围
- **20000-29999**: 成功状态
- **40000-49999**: 客户端错误
- **50000-59999**: 服务器错误

## 业务码详细分类

### 1. 通用业务码 (CommonBusinessCode)

| 业务码 | 名称 | 描述 | HTTP映射 |
|--------|------|------|----------|
| 20000 | SUCCESS | 操作成功 | 200 |
| 20001 | CREATED | 创建成功 | 201 |
| 20002 | UPDATED | 更新成功 | 200 |
| 20003 | DELETED | 删除成功 | 200 |
| 20004 | OPERATION_SUCCESS | 操作成功 | 200 |
| 40000 | BAD_REQUEST | 请求参数错误 | 400 |
| 40001 | UNAUTHORIZED | 未授权访问 | 401 |
| 40002 | FORBIDDEN | 权限不足 | 403 |
| 40003 | NOT_FOUND | 资源不存在 | 404 |
| 40004 | METHOD_NOT_ALLOWED | 请求方法不允许 | 405 |
| 40005 | CONFLICT | 资源冲突 | 409 |
| 40006 | UNPROCESSABLE_ENTITY | 请求参数验证失败 | 422 |
| 40007 | TOO_MANY_REQUESTS | 请求过于频繁 | 429 |
| 50000 | INTERNAL_SERVER_ERROR | 服务器内部错误 | 500 |
| 50001 | SERVICE_UNAVAILABLE | 服务暂不可用 | 503 |
| 50002 | BAD_GATEWAY | 错误网关 | 502 |
| 50003 | GATEWAY_TIMEOUT | 网关超时 | 504 |

### 2. 用户模块 (UserBusinessCode)

#### 成功状态码 (20010-20019)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 20010 | USER_CREATED | 用户创建成功 |
| 20011 | USER_RETRIEVED | 用户获取成功 |
| 20012 | USERS_RETRIEVED | 用户列表获取成功 |
| 20013 | USER_UPDATED | 用户更新成功 |
| 20014 | USER_DELETED | 用户删除成功 |
| 20015 | USER_LOGIN_SUCCESS | 用户登录成功 |
| 20016 | USER_LOGOUT_SUCCESS | 用户登出成功 |
| 20017 | USER_PASSWORD_CHANGED | 密码修改成功 |
| 20018 | USER_PROFILE_UPDATED | 用户资料更新成功 |
| 20019 | CACHE_CLEARED | 缓存清除成功 |

#### 客户端错误码 (40010-40019)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40010 | USER_NOT_FOUND | 用户不存在 |
| 40011 | USER_ALREADY_EXISTS | 用户已存在 |
| 40012 | INVALID_USER_ID | 无效的用户ID |
| 40013 | INVALID_EMAIL_FORMAT | 邮箱格式无效 |
| 40014 | INVALID_PASSWORD_FORMAT | 密码格式无效 |
| 40015 | USER_DISABLED | 用户已被禁用 |
| 40016 | USER_NOT_ACTIVATED | 用户未激活 |
| 40017 | INVALID_CREDENTIALS | 无效的凭证 |
| 40018 | TOKEN_EXPIRED | Token已过期 |
| 40019 | TOKEN_INVALID | Token无效 |

#### 服务器错误码 (50010-50019)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50010 | USER_CREATE_FAILED | 用户创建失败 |
| 50011 | USER_UPDATE_FAILED | 用户更新失败 |
| 50012 | USER_DELETE_FAILED | 用户删除失败 |
| 50013 | USER_FETCH_FAILED | 用户获取失败 |
| 50014 | USER_LOGIN_FAILED | 用户登录失败 |
| 50015 | USER_LOGOUT_FAILED | 用户登出失败 |
| 50016 | PASSWORD_CHANGE_FAILED | 密码修改失败 |
| 50017 | PROFILE_UPDATE_FAILED | 资料更新失败 |
| 50018 | CACHE_CLEAR_FAILED | 缓存清除失败 |
| 50019 | TOKEN_GENERATION_FAILED | Token生成失败 |

### 3. 订单模块 (OrderBusinessCode)

#### 成功状态码 (20020-20027)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 20020 | ORDER_CREATED | 订单创建成功 |
| 20021 | ORDER_RETRIEVED | 订单获取成功 |
| 20022 | ORDERS_RETRIEVED | 订单列表获取成功 |
| 20023 | ORDER_UPDATED | 订单更新成功 |
| 20024 | ORDER_CANCELLED | 订单取消成功 |
| 20025 | ORDER_CONFIRMED | 订单确认成功 |
| 20026 | ORDER_SHIPPED | 订单发货成功 |
| 20027 | ORDER_DELIVERED | 订单送达成功 |

#### 客户端错误码 (40020-40025)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40020 | ORDER_NOT_FOUND | 订单不存在 |
| 40021 | ORDER_ALREADY_EXISTS | 订单已存在 |
| 40022 | INVALID_ORDER_ID | 无效的订单ID |
| 40023 | ORDER_STATUS_INVALID | 订单状态无效 |
| 40024 | ORDER_CANNOT_BE_CANCELLED | 订单无法取消 |
| 40025 | ORDER_CANNOT_BE_UPDATED | 订单无法更新 |

#### 服务器错误码 (50020-50023)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50020 | ORDER_CREATE_FAILED | 订单创建失败 |
| 50021 | ORDER_UPDATE_FAILED | 订单更新失败 |
| 50022 | ORDER_CANCEL_FAILED | 订单取消失败 |
| 50023 | ORDER_FETCH_FAILED | 订单获取失败 |

### 4. 商品模块 (ProductBusinessCode)

#### 成功状态码 (20030-20035)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 20030 | PRODUCT_CREATED | 商品创建成功 |
| 20031 | PRODUCT_RETRIEVED | 商品获取成功 |
| 20032 | PRODUCTS_RETRIEVED | 商品列表获取成功 |
| 20033 | PRODUCT_UPDATED | 商品更新成功 |
| 20034 | PRODUCT_DELETED | 商品删除成功 |
| 20035 | INVENTORY_UPDATED | 库存更新成功 |

#### 客户端错误码 (40030-40034)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40030 | PRODUCT_NOT_FOUND | 商品不存在 |
| 40031 | PRODUCT_ALREADY_EXISTS | 商品已存在 |
| 40032 | INVALID_PRODUCT_ID | 无效的商品ID |
| 40033 | PRODUCT_OUT_OF_STOCK | 商品缺货 |
| 40034 | INVALID_INVENTORY_QUANTITY | 无效的库存数量 |

#### 服务器错误码 (50030-50034)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50030 | PRODUCT_CREATE_FAILED | 商品创建失败 |
| 50031 | PRODUCT_UPDATE_FAILED | 商品更新失败 |
| 50032 | PRODUCT_DELETE_FAILED | 商品删除失败 |
| 50033 | PRODUCT_FETCH_FAILED | 商品获取失败 |
| 50034 | INVENTORY_UPDATE_FAILED | 库存更新失败 |

### 5. 支付模块 (PaymentBusinessCode)

#### 成功状态码 (20040-20043)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 20040 | PAYMENT_SUCCESS | 支付成功 |
| 20041 | PAYMENT_INITIATED | 支付初始化成功 |
| 20042 | PAYMENT_CONFIRMED | 支付确认成功 |
| 20043 | REFUND_SUCCESS | 退款成功 |

#### 客户端错误码 (40040-40044)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40040 | PAYMENT_NOT_FOUND | 支付记录不存在 |
| 40041 | INVALID_PAYMENT_ID | 无效的支付ID |
| 40042 | PAYMENT_ALREADY_PROCESSED | 支付已处理 |
| 40043 | INSUFFICIENT_BALANCE | 余额不足 |
| 40044 | PAYMENT_METHOD_INVALID | 支付方式无效 |

#### 服务器错误码 (50040-50043)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50040 | PAYMENT_PROCESSING_FAILED | 支付处理失败 |
| 50041 | PAYMENT_INITIATION_FAILED | 支付初始化失败 |
| 50042 | REFUND_FAILED | 退款失败 |
| 50043 | PAYMENT_GATEWAY_ERROR | 支付网关错误 |

### 6. 系统模块 (SystemBusinessCode)

#### 成功状态码 (20050-20053)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 20050 | HEALTH_CHECK_SUCCESS | 健康检查成功 |
| 20051 | SYSTEM_STATUS_OK | 系统状态正常 |
| 20052 | MAINTENANCE_MODE_ENABLED | 维护模式已启用 |
| 20053 | MAINTENANCE_MODE_DISABLED | 维护模式已禁用 |

#### 客户端错误码 (40050-40051)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40050 | SYSTEM_MAINTENANCE | 系统维护中 |
| 40051 | API_VERSION_NOT_SUPPORTED | API版本不支持 |

#### 服务器错误码 (50050-50053)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50050 | SYSTEM_ERROR | 系统错误 |
| 50051 | DATABASE_CONNECTION_FAILED | 数据库连接失败 |
| 50052 | CACHE_CONNECTION_FAILED | 缓存连接失败 |
| 50053 | EXTERNAL_SERVICE_ERROR | 外部服务错误 |

### 7. 分页查询状态码规范

分页查询统一使用系统的业务状态码规范：

- **成功响应**: 使用 20000 (SUCCESS) - 操作成功
- **参数错误**: 使用 40010 (INVALID_PARAMETER) - 参数无效
- **服务器错误**: 使用 50000 (INTERNAL_ERROR) - 内部服务器错误

参数验证错误详情将在 `error.validation` 字段中返回：

```json
{
  "code": 40010,
  "message": "参数无效",
  "error": {
    "validation": {
      "page": ["页码必须大于等于1"],
      "pageSize": ["页大小必须在1-100之间"],
      "sortBy": ["排序字段不合法"],
      "sortOrder": ["排序方向必须是asc或desc"]
    }
  }
}
```

## 分页响应规范

### 标准分页数据结构

所有列表查询接口必须遵循统一的分页响应格式：

```typescript
interface PaginationResponse<T> {
  code: number;
  message: string;
  data: {
    list: T[];           // 数据列表
    pagination: {
      page: number;      // 当前页码
      pageSize: number;  // 每页条数
      total: number;     // 总记录数
      totalPages: number; // 总页数
    }
  }
}

// 客户端判断逻辑
// 是否有下一页: page < totalPages
// 是否有上一页: page > 1
// 是否为空结果: total === 0
// 是否为最后一页: page === totalPages
```

### 分页请求参数规范

```typescript
interface PaginationRequest {
  page?: number;      // 页码，默认1
  pageSize?: number;  // 每页条数，默认10，最大100
  sortBy?: string;    // 排序字段
  sortOrder?: 'asc' | 'desc'; // 排序方向
  search?: string;    // 搜索关键词
}
```

### 分页业务状态码

分页查询使用统一的业务状态码规范：

- **成功响应**: 使用 20000 (SUCCESS) - 操作成功
- **参数错误**: 使用 40010 (INVALID_PARAMETER) - 参数无效
- **服务器错误**: 使用 50000 (INTERNAL_ERROR) - 内部服务器错误

#### 客户端错误码 (40050-40051)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 40050 | SYSTEM_MAINTENANCE | 系统维护中 |
| 40051 | API_VERSION_NOT_SUPPORTED | API版本不支持 |

#### 服务器错误码 (50050-50053)
| 业务码 | 名称 | 描述 |
|--------|------|------|
| 50050 | SYSTEM_ERROR | 系统错误 |
| 50051 | DATABASE_CONNECTION_FAILED | 数据库连接失败 |
| 50052 | CACHE_CONNECTION_FAILED | 缓存连接失败 |
| 50053 | EXTERNAL_SERVICE_ERROR | 外部服务错误 |

## 响应格式规范

### 1. 统一响应结构

所有API响应都遵循统一的JSON格式：

#### 成功响应格式
```json
{
  "code": 20000,
  "message": "操作成功",
  "data": {
    // 具体业务数据
  },
  "timestamp": 1703692800000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "path": "/api/v1/users",
  "method": "GET"
}
```

#### 分页响应格式
```json
{
  "code": 20000,
  "message": "操作成功",
  "data": {
    "list": [
      // 数据列表
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100,
      "totalPages": 10
    }
  },
  "timestamp": 1703692800000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "path": "/api/v1/users",
  "method": "GET"
}
```

#### 错误响应格式
```json
{
  "code": 40010,
  "message": "用户不存在",
  "data": null,
  "error": {
    "type": "NotFoundError",
    "description": "用户不存在",
    "stack": "Error: 用户不存在\n    at ...", // 开发环境
    "validation": { // 验证错误时
      "email": ["邮箱格式不正确"],
      "password": ["密码长度不能少于6位"]
    },
    "errorId": "err-123456789"
  },
  "timestamp": 1703692800000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "path": "/api/v1/users/123",
  "method": "GET"
}
```

### 2. 字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | number | 业务状态码，5位数字 |
| message | string | 状态描述信息 |
| data | any | 响应数据，成功时返回具体数据，错误时为null |
| error | object | 错误详情，仅在错误响应中包含 |
| timestamp | number | 响应时间戳（毫秒） |
| requestId | string | 请求唯一标识，用于链路追踪 |
| path | string | 当前请求的API路径 |
| method | string | HTTP请求方法（GET, POST, PUT, DELETE等） |

## 实际业务码对照表

基于实际代码实现，以下是当前项目中定义的所有业务码：

### 实际通用业务码
- **20000**: SUCCESS - 操作成功
- **20001**: CREATED - 创建成功  
- **20002**: UPDATED - 更新成功
- **20003**: DELETED - 删除成功
- **20004**: OPERATION_SUCCESS - 操作成功

### 实际用户模块业务码
- **20010-20019**: 用户相关成功状态
- **40010-40019**: 用户相关客户端错误
- **50010-50019**: 用户相关服务器错误

### 实际订单模块业务码  
- **20020-20027**: 订单相关成功状态
- **40020-40025**: 订单相关客户端错误
- **50020-50023**: 订单相关服务器错误

### 实际商品模块业务码
- **20030-20035**: 商品相关成功状态
- **40030-40034**: 商品相关客户端错误
- **50030-50034**: 商品相关服务器错误

### 实际支付模块业务码
- **20040-20043**: 支付相关成功状态
- **40040-40044**: 支付相关客户端错误
- **50040-50043**: 支付相关服务器错误

### 实际系统模块业务码
- **20050-20053**: 系统相关成功状态
- **40050-40051**: 系统相关客户端错误
- **50050-20053**: 系统相关服务器错误

## 使用指南

### 1. 使用ResponseUtil工具类

```typescript
import { ResponseUtil } from '../utils/response.js'
import { UserBusinessCode } from '../../../constants/business-code.js'

// 成功响应 - 默认使用20000
return ResponseUtil.send(
  reply, 
  request, 
  userData, 
  '用户获取成功', 
  UserBusinessCode.USER_RETRIEVED
)

// 使用默认成功码20000
return ResponseUtil.send(
  reply,
  request,
  userData,
  '操作成功'
  // 不指定code时自动使用20000
)

// 分页响应
return ResponseUtil.paginated(
  reply,
  request,
  userList,
  totalCount,
  page,
  pageSize,
  '用户列表获取成功',
  UserBusinessCode.USERS_RETRIEVED
)

// 错误响应
return ResponseUtil.error(
  reply,
  request,
  '用户不存在',
  UserBusinessCode.USER_NOT_FOUND,
  error
)
```

### 2. 使用装饰器（推荐）

```typescript
import { Success, Created, Updated, Deleted, Paginated, List } from '../decorators/response.js'

class UserController {
  @Success('用户获取成功')
  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const user = await this.userService.findById(request.params.id)
    return user
  }

  @Created('用户创建成功')
  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const user = await this.userService.create(request.body)
    return user
  }

  @Updated('用户更新成功')
  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const user = await this.userService.update(request.params.id, request.body)
    return user
  }

  @Deleted('用户删除成功')
  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    await this.userService.delete(request.params.id)
  }

  @Paginated('用户列表获取成功')
  async getUserList(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, pageSize = 10 } = request.query
    return await this.userService.findAll(page, pageSize)
  }

  @List('用户列表获取成功')
  async getAllUsers(request: FastifyRequest, reply: FastifyReply) {
    return await this.userService.findAllWithoutPagination()
  }
}
```

### 3. 使用Reply装饰器方法

```typescript
// 插件自动为FastifyReply添加了响应方法
fastify.get('/users/:id', async (request, reply) => {
  const user = await userService.findById(request.params.id)
  
  // 使用装饰器方法
  return reply.sendSuccess(user, '用户获取成功')
})

fastify.post('/users', async (request, reply) => {
  const user = await userService.create(request.body)
  
  // 使用装饰器方法
  return reply.sendCreated(user, '用户创建成功')
})

fastify.get('/users', async (request, reply) => {
  const { users, total, page, pageSize } = await userService.findAll(request.query)
  
  // 使用装饰器方法
  return reply.sendPaginated(users, total, page, pageSize, '用户列表获取成功')
})
```

## 开发规范

### 1. 业务码选择规范
- 每个业务操作必须使用对应的业务码
- 新增业务码时需遵循编码规则
- 同一业务场景使用相同的业务码
- 默认成功码为20000

### 2. 消息描述规范
- 成功消息使用积极的表达方式
- 错误消息清晰描述问题原因
- 保持消息简洁明了

### 3. 数据返回规范
- 单个对象直接返回
- 列表数据使用数组返回
- 分页数据使用标准分页结构
- 敏感信息需脱敏处理

### 4. 错误处理规范
- 所有错误必须有对应的业务码
- 开发环境包含详细错误信息
- 生产环境隐藏敏感错误信息
- 验证错误需包含具体字段信息

## 工具类API参考

### ResponseUtil 静态方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| send | reply, request, data, message?, code?, httpStatus? | FastifyReply | 通用成功响应 |
| created | reply, request, data, message? | FastifyReply | 创建成功响应 |
| updated | reply, request, data?, message? | FastifyReply | 更新成功响应 |
| deleted | reply, request, message? | FastifyReply | 删除成功响应 |
| list | reply, request, data, message?, code?, httpStatus? | FastifyReply | 列表响应 |
| paginated | reply, request, data, total, page, pageSize, message?, code?, httpStatus? | FastifyReply | 分页响应 |
| error | reply, request, message?, code?, error?, httpStatus? | FastifyReply | 错误响应 |
| validationError | reply, request, validation, message? | FastifyReply | 验证错误响应 |
| unauthorized | reply, request, message? | FastifyReply | 未授权响应 |
| forbidden | reply, request, message? | FastifyReply | 权限不足响应 |
| notFound | reply, request, message? | FastifyReply | 资源不存在响应 |
| tooManyRequests | reply, request, message? | FastifyReply | 请求频繁响应 |
| serviceUnavailable | reply, request, message? | FastifyReply | 服务不可用响应 |

### BusinessCodeUtil 工具方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| getHttpStatus | businessCode: number | number | 根据业务码获取HTTP状态码 |
| isSuccess | businessCode: number | boolean | 判断是否为成功状态码 |
| isClientError | businessCode: number | boolean | 判断是否为客户端错误码 |
| isServerError | businessCode: number | boolean | 判断是否为服务器错误码 |
| getDescription | businessCode: number | string | 获取业务码描述 |

## 扩展指南

### 1. 新增业务模块

1. 在 `src/constants/business-code.ts` 中新增模块枚举
2. 遵循编码规则定义新的业务码范围
3. 在文档中补充新增模块的说明

### 2. 自定义响应格式

1. 继承 `BaseResponse` 接口定义新的响应类型
2. 在 `ResponseUtil` 中添加对应的响应方法
3. 更新装饰器支持新的响应类型

### 3. 国际化支持

1. 将 `ResponseMessage` 中的消息提取到国际化文件
2. 根据请求头中的语言参数返回对应语言的消息
3. 保持业务码不变，仅消息内容国际化

## 最佳实践

### 1. 分层架构
```
Controller层: 使用装饰器简化响应
Service层: 返回业务数据或抛出业务异常
Repository层: 返回原始数据或抛出数据异常
```

### 2. 错误处理链
```
业务异常 → 业务码 + 友好消息
系统异常 → 50000系列码 + 通用消息
验证异常 → 40006 + 字段级错误信息
```

### 3. 监控和日志
- 所有响应记录requestId用于链路追踪
- 错误响应记录详细错误日志
- 业务码统计用于业务监控
- 响应时间记录用于性能监控

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0.0 | 2024-01-01 | 初始版本，建立双重状态码体系 |
| 1.1.0 | 2024-02-15 | 增加分页响应结构 |
| 1.2.0 | 2024-03-20 | 增加装饰器支持 |
| 1.3.0 | 2024-04-10 | 完善业务码分类 |
| 1.4.0 | 2024-12-28 | 同步实际代码实现，修正业务码范围 |

---

*本文档最后更新于 2024-12-28*