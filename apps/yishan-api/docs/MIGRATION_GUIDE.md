# 业务码使用指南 - 渐进式开发版本

## 概述

本指南介绍如何使用项目的业务码系统。我们采用参考支付宝规范的分层设计，并遵循渐进式开发原则：**只定义当前需要的，未来按需扩展**。

## 设计原则

### 1. 渐进式开发
- **当前优先**：只定义项目当前实际使用的业务码
- **按需扩展**：新功能开发时再添加对应的业务码
- **避免过度设计**：不预先定义可能永远用不到的错误码

### 2. 分层架构
- **1xxxx**: 成功码（预留扩展空间）
- **2xxxx**: 公共错误码（系统、参数、权限等）
- **3xxxx**: 业务错误码（用户、部门、角色等）

### 3. 兼容性保证
- 保留现有的业务码导出（如 `UserBusinessCode`、`DepartmentBusinessCode`）
- 新旧代码可以并存，逐步迁移

## 当前业务码结构

### 成功码
```typescript
SUCCESS_CODE = 10000  // 统一成功码
```

### 公共错误码 (2xxxx)
```typescript
// 系统错误 (20xxx)
CommonErrorCode.SYSTEM_ERROR = 20001
CommonErrorCode.DATABASE_ERROR = 20002
CommonErrorCode.NETWORK_ERROR = 20003

// 参数错误 (21xxx)  
CommonErrorCode.INVALID_PARAMETER = 21001
CommonErrorCode.MISSING_PARAMETER = 21002

// 权限错误 (22xxx)
CommonErrorCode.UNAUTHORIZED = 22001
CommonErrorCode.TOKEN_EXPIRED = 22002
CommonErrorCode.FORBIDDEN = 22004

// 请求错误 (23xxx)
CommonErrorCode.METHOD_NOT_ALLOWED = 23001
CommonErrorCode.TOO_MANY_REQUESTS = 23002
```

### 业务错误码 (3xxxx)
```typescript
// 用户模块 (30xxx)
BusinessErrorCode.USER_NOT_FOUND = 30001
BusinessErrorCode.USER_ALREADY_EXISTS = 30002
BusinessErrorCode.INVALID_CREDENTIALS = 30005

// 部门模块 (31xxx)
BusinessErrorCode.DEPARTMENT_NOT_FOUND = 31001
BusinessErrorCode.DEPARTMENT_HAS_CHILDREN = 31003

// 角色模块 (32xxx) 
BusinessErrorCode.ROLE_NOT_FOUND = 32001
BusinessErrorCode.ROLE_IN_USE = 32003
```
## 快速开始

### 1. 基本使用

```typescript
import { 
  SUCCESS_CODE,
  CommonErrorCode,
  BusinessErrorCode,
  ResponseBuilder 
} from '../constants/business-code.js'

// 成功响应
return ResponseBuilder.success(data, '操作成功')

// 公共错误响应
return ResponseBuilder.commonError('INVALID_PARAMETER', '参数错误')

// 业务错误响应  
return ResponseBuilder.businessError('USER_NOT_FOUND', '用户不存在')
```

### 2. 在 Fastify 路由中使用

```typescript
// 用户登录示例
fastify.post('/login', async (request, reply) => {
  try {
    const { username, password } = request.body
    
    // 参数验证
    if (!username || !password) {
      return ResponseBuilder.commonError('MISSING_PARAMETER', '用户名和密码不能为空')
    }
    
    // 业务逻辑
    const user = await userService.login(username, password)
    if (!user) {
      return ResponseBuilder.businessError('INVALID_CREDENTIALS', '用户名或密码错误')
    }
    
    // 成功响应
    return ResponseBuilder.success(user, '登录成功')
    
  } catch (error) {
    return ResponseBuilder.commonError('SYSTEM_ERROR', '系统错误', error)
  }
})
```

## 渐进式扩展指南

### 添加新的业务模块

当需要添加新的业务模块时，按以下步骤进行：

#### 1. 定义业务错误码
```typescript
// 在 BusinessErrorCode 中添加新模块（如订单模块 33xxx）
export const BusinessErrorCode = {
  // ... 现有代码
  
  // 订单模块 (33xxx)
  ORDER_NOT_FOUND: 33001,
  ORDER_STATUS_INVALID: 33002,
  ORDER_PAYMENT_FAILED: 33003,
} as const;
```

#### 2. 添加子错误码映射
```typescript
// 在 SubErrorCode 中添加对应映射
export const SubErrorCode = {
  // ... 现有代码
  
  [BusinessErrorCode.ORDER_NOT_FOUND]: {
    sub_code: 'ORDER_NOT_FOUND',
    sub_message: '订单不存在'
  },
  [BusinessErrorCode.ORDER_STATUS_INVALID]: {
    sub_code: 'ORDER_STATUS_INVALID', 
    sub_message: '订单状态无效'
  },
} as const;
```

#### 3. 创建兼容性导出
```typescript
// 为了保持一致性，创建 OrderBusinessCode
export const OrderBusinessCode = {
  // 成功操作
  ORDER_CREATED: SUCCESS_CODE,
  ORDER_RETRIEVED: SUCCESS_CODE,
  ORDER_UPDATED: SUCCESS_CODE,
  
  // 错误操作
  ORDER_NOT_FOUND: BusinessErrorCode.ORDER_NOT_FOUND,
  ORDER_STATUS_INVALID: BusinessErrorCode.ORDER_STATUS_INVALID,
  
  // 操作失败
  ORDER_CREATE_FAILED: CommonErrorCode.SYSTEM_ERROR,
} as const;
```
### 添加新的公共错误类型

当需要添加新的公共错误类型时：

```typescript
// 在 CommonErrorCode 中添加新类型（如文件操作错误 24xxx）
export const CommonErrorCode = {
  // ... 现有代码
  
  // 文件操作错误 (24xxx)
  FILE_NOT_FOUND: 24001,
  FILE_TOO_LARGE: 24002,
  INVALID_FILE_TYPE: 24003,
} as const;

// 在 BusinessCodeUtil.getHttpStatus 中添加HTTP状态码映射
static getHttpStatus(code: number): number {
  // ... 现有代码
  
  case CommonErrorCode.FILE_NOT_FOUND:
    return 404;
  case CommonErrorCode.FILE_TOO_LARGE:
    return 413;
  case CommonErrorCode.INVALID_FILE_TYPE:
    return 415;
}
```

## 最佳实践

### 1. 错误码命名规范
- **语义化命名**：使用清晰的英文描述错误类型
- **模块前缀**：业务错误码使用模块名作为前缀
- **动作描述**：明确描述错误的具体原因

### 2. 错误消息设计
- **用户友好**：错误消息应该对用户友好，避免技术术语
- **可操作性**：提供用户可以采取的解决方案
- **国际化支持**：考虑多语言支持的需求

### 3. 渐进式扩展原则
- **需求驱动**：只在有实际需求时添加新的错误码
- **向前兼容**：新增错误码不影响现有功能
- **文档同步**：及时更新文档和示例

## 常见问题 (FAQ)

### Q: 什么时候使用公共错误码，什么时候使用业务错误码？
A: 
- **公共错误码**：系统级错误（如网络错误、数据库错误、参数验证错误）
- **业务错误码**：业务逻辑错误（如用户不存在、权限不足、状态不匹配）

### Q: 如何处理复杂的错误场景？
A: 使用 `sub_code` 和 `sub_message` 提供更详细的错误分类：

```typescript
// 用户登录失败的细分场景
const SubErrorCode = {
  [BusinessErrorCode.INVALID_CREDENTIALS]: {
    sub_code: 'INVALID_CREDENTIALS',
    sub_message: '用户名或密码错误'
  },
  [BusinessErrorCode.USER_ACCOUNT_LOCKED]: {
    sub_code: 'ACCOUNT_LOCKED', 
    sub_message: '账户已被锁定，请联系管理员'
  }
}
```

### Q: 如何扩展新的业务模块？
A: 按照渐进式扩展指南，为新模块分配专用的错误码范围（如 34xxx），并创建对应的兼容性导出。

## 总结

渐进式业务码设计的核心优势：

1. **简化开发**：只定义当前需要的，避免过度设计
2. **易于维护**：清晰的分层结构，便于理解和维护  
3. **灵活扩展**：按需添加新的错误码，不影响现有功能
4. **标准化**：参考支付宝规范，提供一致的错误处理体验
5. **向前兼容**：保留现有接口，平滑迁移

通过这种设计，我们既保证了系统的稳定性，又为未来的功能扩展留下了充足的空间。

### 部门管理接口迁移

#### 旧版本实现
```typescript
// 创建部门 - 旧版本
fastify.post('/', {
  handler: async (request, reply) => {
    try {
      const department = await departmentService.createDepartment(createData)
      
      return ResponseUtil.send(
        reply,
        request,
        department,
        '创建成功',
        DepartmentBusinessCode.DEPARTMENT_CREATED
      )
    } catch (error) {
      return ResponseUtil.error(
        reply,
        request,
        '创建失败',
        DepartmentBusinessCode.DEPARTMENT_CREATE_FAILED,
        error,
        500
      )
    }
  }
})
```

#### 新版本实现
```typescript
// 创建部门 - 新版本
fastify.post('/', {
  handler: async (request, reply) => {
    try {
      const department = await departmentService.createDepartment(createData)
      
      return NewResponseUtil.created(
        reply,
        request,
        department,
        '创建成功'
      )
    } catch (error) {
      // 根据错误类型返回不同的业务错误码
      if (error.message.includes('名称重复')) {
        return NewResponseUtil.businessError(
          reply,
          request,
          BusinessErrorCode.DEPARTMENT_NAME_DUPLICATE,
          '部门名称重复',
          error
        )
      }
      
      return NewResponseUtil.systemError(
        reply,
        request,
        '创建失败',
        error
      )
    }
  }
})
```

### 错误处理最佳实践

```typescript
// 统一错误处理中间件
fastify.setErrorHandler(async (error, request, reply) => {
  // 参数验证错误
  if (error.validation) {
    return NewResponseUtil.validationError(
      reply,
      request,
      error.validation,
      '参数验证失败'
    )
  }
  
  // 数据库错误
  if (error.code === 'ER_DUP_ENTRY') {
    return NewResponseUtil.businessError(
      reply,
      request,
      BusinessErrorCode.DEPARTMENT_NAME_DUPLICATE,
      '数据重复',
      error
    )
  }
  
  // 默认系统错误
  return NewResponseUtil.systemError(
    reply,
    request,
    '系统内部错误',
    error
  )
})
```

## 前端适配

### 响应处理适配

```typescript
// 通用响应处理函数
function handleApiResponse(response: any) {
  // 新格式检测
  if (typeof response.success === 'boolean') {
    return {
      success: response.success,
      code: response.code,
      message: response.message,
      data: response.data,
      subCode: response.sub_code,
      subMessage: response.sub_message
    }
  }
  
  // 旧格式兼容
  return {
    success: response.isSuccess,
    code: response.code,
    message: response.message,
    data: response.data
  }
}
```

### 错误码处理

```typescript
// 错误码常量映射
const ERROR_CODE_MAP = {
  // 新错误码
  10001: '系统内部错误',
  11000: '参数无效',
  12000: '未授权访问',
  21001: '部门不存在',
  21002: '部门名称重复',
  
  // 旧错误码兼容
  40001: '参数错误',
  40401: '未授权',
  50001: '系统错误'
}

function getErrorMessage(code: number, message?: string): string {
  return message || ERROR_CODE_MAP[code] || '未知错误'
}
```

## 测试策略

### 单元测试

```typescript
describe('NewResponseUtil', () => {
  test('should return success response with unified code', () => {
    const mockReply = createMockReply()
    const mockRequest = createMockRequest()
    
    NewResponseUtil.success(mockReply, mockRequest, { id: 1 }, '操作成功')
    
    expect(mockReply.send).toHaveBeenCalledWith({
      success: true,
      code: 10000,
      message: '操作成功',
      data: { id: 1 },
      timestamp: expect.any(Number),
      request_id: expect.any(String)
    })
  })
  
  test('should return business error with sub code', () => {
    const mockReply = createMockReply()
    const mockRequest = createMockRequest()
    
    NewResponseUtil.businessError(
      mockReply, 
      mockRequest, 
      BusinessErrorCode.DEPARTMENT_NOT_FOUND,
      '部门不存在'
    )
    
    expect(mockReply.send).toHaveBeenCalledWith({
      success: false,
      code: 21001,
      message: '部门不存在',
      sub_code: 'department.not_found',
      sub_message: '部门不存在',
      data: null,
      timestamp: expect.any(Number),
      request_id: expect.any(String)
    })
  })

  test('POST /departments should return 409 on duplicate name', async () => {
    const name = '迁移测试重复_' + Date.now()

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/departments',
      payload: { deptName: name, parentId: null, deptType: 2, status: 1 },
      headers: { authorization: 'Bearer token' }
    })
    expect(first.statusCode).toBe(200)

    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/departments',
      payload: { deptName: name, parentId: null, deptType: 2, status: 1 },
      headers: { authorization: 'Bearer token' }
    })
    expect(dup.statusCode).toBe(409)
    expect(dup.json()).toMatchObject({
      success: false,
      code: 31002,
      message: '部门名称重复'
    })
  })
})
```

### 集成测试

```typescript
describe('Department API with new response format', () => {
  test('POST /departments should return unified success code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/departments',
      payload: { name: '测试部门' },
      headers: { authorization: 'Bearer token' }
    })
    
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      success: true,
      code: 10000,
      message: '创建成功',
      data: expect.objectContaining({
        name: '测试部门'
      })
    })
  })
})
```

## 注意事项

1. **向后兼容**：确保旧接口在迁移期间正常工作
2. **错误码映射**：建立新旧错误码的映射关系
3. **文档更新**：及时更新API文档说明新的响应格式
4. **监控告警**：监控新旧格式的使用情况
5. **逐步迁移**：按模块逐步迁移，避免一次性大规模修改

## 迁移检查清单

- [ ] 引入新的业务码常量
- [ ] 创建新的ResponseUtil工具类
- [ ] 更新类型定义文件
- [ ] 迁移成功响应处理
- [ ] 迁移错误响应处理
- [ ] 更新错误处理中间件
- [ ] 适配前端响应处理
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 更新API文档
- [ ] 部署到测试环境验证
- [ ] 逐步迁移生产环境

通过遵循这个渐进式开发指南，你可以构建一个清晰、可维护、易扩展的业务码系统，提升开发效率和用户体验。