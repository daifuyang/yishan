# 响应规范指南

## 概述

本文档定义了移山 API 的企业级响应规范，专为前后端协作、TypeScript类型定义和Swagger/OpenAPI集成优化。所有接口必须严格遵循此规范。

## 统一响应结构

### 基础响应接口 (Base Response)

```typescript
// 通用响应接口
interface ApiResponse<T = any> {
  code: number;        // 业务码（5位数字）
  message: string;     // 业务消息
  data: T;            // 业务数据
  timestamp: number;   // 时间戳（毫秒）
  requestId: string;   // 请求ID
  success: boolean;    // 操作是否成功
}

// 错误响应接口
interface ApiErrorResponse extends ApiResponse<null> {
  success: false;
  details?: ValidationError[] | BusinessError;
}

// 验证错误详情
interface ValidationError {
  field: string;
  value?: any;
  message: string;
  code: string;
}

// 业务错误详情
interface BusinessError {
  type: string;
  context?: Record<string, any>;
}
```

### 成功响应格式

```json
{
  "code": 20000,
  "message": "操作成功",
  "data": {},
  "timestamp": 1701234567890,
  "requestId": "req_123456789",
  "success": true
}
```

### 失败响应格式

#### 参数验证错误
```json
{
  "code": 40001,
  "message": "参数验证失败",
  "data": null,
  "timestamp": 1701234567890,
  "requestId": "req_123456789",
  "success": false,
  "details": [
    {
      "field": "email",
      "value": "invalid-email",
      "message": "邮箱格式不正确",
      "code": "EMAIL_INVALID"
    },
    {
      "field": "password",
      "message": "密码长度不能少于8位",
      "code": "PASSWORD_TOO_SHORT"
    }
  ]
}
```

#### 业务逻辑错误
```json
{
  "code": 40401,
  "message": "用户不存在",
  "data": null,
  "timestamp": 1701234567890,
  "requestId": "req_123456789",
  "success": false,
  "details": {
    "type": "USER_NOT_FOUND",
    "context": {
      "userId": 12345
    }
  }
}
```

## HTTP状态码与业务码映射

### HTTP状态码规范
**HTTP状态码**仅表示传输层状态，不表示业务结果：
- `200` - 请求成功（所有业务逻辑正常处理）
- `400` - 参数格式错误
- `401` - 未认证或认证失败
- `403` - 无权限访问
- `404` - 资源不存在
- `500` - 服务器内部错误

### 业务码规范
**业务码**表示具体的业务操作结果，采用5位数字编码：

#### 成功码（2xxxx）
| 业务码 | 含义 | 说明 |
|--------|------|------|
| 20000 | 操作成功 | 通用成功 |
| 20001 | 创建成功 | POST操作 |
| 20002 | 更新成功 | PUT/PATCH操作 |
| 20003 | 删除成功 | DELETE操作 |

#### 客户端错误码（4xxxx）
| 业务码 | 含义 | 说明 |
|--------|------|------|
| 40001 | 参数验证失败 | 请求参数不合法 |
| 40002 | 业务规则冲突 | 违反业务约束 |
| 40003 | 资源已存在 | 重复创建 |
| 40101 | 认证失败 | 用户名或密码错误 |
| 40102 | Token过期 | 需要重新登录 |
| 40301 | 权限不足 | 无操作权限 |
| 40401 | 资源不存在 | 查询的资源不存在 |
| 42201 | 数据验证失败 | 业务数据验证错误 |

#### 服务端错误码（5xxxx）
| 业务码 | 含义 | 说明 |
|--------|------|------|
| 50001 | 系统内部错误 | 通用系统错误 |
| 50002 | 数据库操作失败 | 数据库异常 |
| 50003 | 第三方服务异常 | 外部依赖错误 |
| 50301 | 服务暂时不可用 | 系统维护中 |

## 分页规范 (企业级)

### 分页请求参数

```typescript
interface PaginationRequest {
  page?: number;      // 当前页码，默认1
  pageSize?: number; // 每页条数，默认20，最大100
  sort?: string;     // 排序字段，格式：field:asc|desc
  keyword?: string;   // 全局搜索关键词
}

// 示例：GET /api/users?page=1&pageSize=20&sort=createdAt:desc&keyword=张三
```

### 分页响应结构

```typescript
interface PaginationResponse<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 统一分页响应
interface PaginatedApiResponse<T> extends ApiResponse<PaginationResponse<T>> {}
```

### 分页响应示例

```json
{
  "code": 20000,
  "message": "查询成功",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "张三",
        "email": "zhangsan@example.com",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1701234567890,
  "requestId": "req_123456789",
  "success": true
}
```

## 筛选规范 (企业级字段化)

### 推荐方式：字段化筛选

采用显式字段定义，类型安全，便于Swagger生成和前端类型推导：

```typescript
// 用户列表查询参数
interface UserListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  keyword?: string;
  
  // 精确筛选
  status?: 'active' | 'inactive' | 'banned';
  role?: string[];
  departmentId?: number;
  
  // 范围筛选
  createdAtStart?: string; // ISO日期
  createdAtEnd?: string;   // ISO日期
  
  // 模糊搜索
  name?: string;
  email?: string;
  phone?: string;
}
```

### 筛选参数示例

```
# 精确筛选
GET /api/users?status=active&role=admin&role=user&departmentId=1

# 时间范围筛选
GET /api/users?createdAtStart=2024-01-01&createdAtEnd=2024-12-31

# 模糊搜索
GET /api/users?name=张&email=example.com

# 组合筛选
GET /api/users?status=active&name=张&createdAtStart=2024-01-01&page=1&pageSize=20&sort=createdAt:desc
```

### 前端TypeScript类型定义

```typescript
// 自动生成的API类型（基于Swagger/OpenAPI）
interface UserApi {
  // 获取用户列表
  getUsers: (params: UserListQuery) => Promise<ApiResponse<PaginationResponse<User>>>;
  
  // 获取单个用户
  getUser: (id: number) => Promise<ApiResponse<User>>;
  
  // 创建用户
  createUser: (data: CreateUserDto) => Promise<ApiResponse<User>>;
  
  // 更新用户
  updateUser: (id: number, data: UpdateUserDto) => Promise<ApiResponse<User>>;
  
  // 删除用户
  deleteUser: (id: number) => Promise<ApiResponse<void>>;
}

// 使用示例
const { data } = await userApi.getUsers({
  page: 1,
  pageSize: 20,
  status: 'active',
  name: '张',
  sort: 'createdAt:desc'
});
```

## Swagger/OpenAPI集成规范

### 响应Schema定义

```yaml
components:
  schemas:
    ApiResponse:
      type: object
      properties:
        code:
          type: integer
          example: 20000
        message:
          type: string
          example: "操作成功"
        data:
          type: object
        timestamp:
          type: integer
          example: 1701234567890
        requestId:
          type: string
          example: "req_123456789"
        success:
          type: boolean
          example: true
      required: [code, message, data, timestamp, requestId, success]

    ErrorResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            success:
              type: boolean
              example: false
            details:
              oneOf:
                - type: array
                  items:
                    $ref: '#/components/schemas/ValidationError'
                - $ref: '#/components/schemas/BusinessError'

    PaginationMeta:
      type: object
      properties:
        page:
          type: integer
          minimum: 1
        pageSize:
          type: integer
          minimum: 1
          maximum: 100
        total:
          type: integer
          minimum: 0
        totalPages:
          type: integer
          minimum: 1
        hasNext:
          type: boolean
        hasPrev:
          type: boolean
```

### API端点定义示例

```yaml
/api/users:
  get:
    summary: 获取用户列表
    parameters:
      - in: query
        name: page
        schema:
          type: integer
          minimum: 1
          default: 1
      - in: query
        name: pageSize
        schema:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
      - in: query
        name: status
        schema:
          type: string
          enum: [active, inactive, banned]
      - in: query
        name: name
        schema:
          type: string
          description: 按名称模糊搜索
      - in: query
        name: createdAtStart
        schema:
          type: string
          format: date-time
      - in: query
        name: createdAtEnd
        schema:
          type: string
          format: date-time
      - in: query
        name: sort
        schema:
          type: string
          pattern: '^[a-zA-Z]+:(asc|desc)$'
          example: "createdAt:desc"
    responses:
      200:
        description: 查询成功
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ApiResponse'
                - type: object
                  properties:
                    data:
                      type: object
                      properties:
                        list:
                          type: array
                          items:
                            $ref: '#/components/schemas/User'
                        pagination:
                          $ref: '#/components/schemas/PaginationMeta'
```

## 企业级最佳实践

### 1. 类型安全优先
- 所有筛选字段必须明确定义类型
- 使用枚举限制可选值范围
- 日期时间使用ISO 8601格式
- 数值类型提供最小/最大值约束

### 2. 前端开发体验
- 提供完整的TypeScript类型定义
- 支持IDE智能提示和类型检查
- 统一的错误处理机制
- 标准化的分页和筛选组件

### 3. 后端实现规范
- 使用装饰器模式定义筛选参数
- 统一的参数验证中间件
- 自动化的Swagger文档生成
- 标准化的错误处理流程

### 4. 筛选字段设计原则
- **精确匹配**：使用等值筛选（如状态、类型）
- **范围筛选**：使用开始/结束时间（如创建时间）
- **模糊搜索**：使用关键词搜索（如名称、描述）
- **关联筛选**：使用关联ID（如部门ID、用户ID）

### 5. 性能优化
- 限制最大分页大小（maxPageSize = 100）
- 提供默认排序字段
- 支持索引字段筛选
- 避免全表扫描

## 代码实现示例

### 筛选参数DTO

```typescript
export class UserListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  createdAtStart?: string;

  @IsOptional()
  @IsDateString()
  createdAtEnd?: string;

  @IsOptional()
  @Matches(/^[a-zA-Z]+:(asc|desc)$/)
  sort?: string = 'createdAt:desc';
}
```

### 统一响应包装器

```typescript
export class ResponseWrapper {
  static success<T>(data: T, message = '操作成功', code = 20000): ApiResponse<T> {
    return {
      code,
      message,
      data,
      timestamp: Date.now(),
      requestId: generateRequestId(),
      success: true
    };
  }

  static created<T>(data: T, message = '创建成功'): ApiResponse<T> {
    return this.success(data, message, 20001);
  }

  static updated<T>(data: T, message = '更新成功'): ApiResponse<T> {
    return this.success(data, message, 20002);
  }

  static deleted(message = '删除成功'): ApiResponse<null> {
    return this.success(null, message, 20003);
  }

  static error(
    message: string,
    code = 40001,
    details?: ValidationError[] | BusinessError
  ): ApiErrorResponse {
    return {
      code,
      message,
      data: null,
      timestamp: Date.now(),
      requestId: generateRequestId(),
      success: false,
      details
    };
  }

  static paginated<T>(
    list: T[],
    pagination: PaginationMeta
  ): PaginatedApiResponse<T> {
    return {
      code: 200,
      message: '查询成功',
      data: { list, pagination },
      timestamp: Date.now(),
      requestId: generateRequestId(),
      success: true
    };
  }
}

// 业务错误码枚举
export enum BusinessCode {
  SUCCESS = 20000,
  CREATED = 20001,
  UPDATED = 20002,
  DELETED = 20003,
  
  VALIDATION_ERROR = 40001,
  BUSINESS_RULE_ERROR = 40002,
  DUPLICATE_RESOURCE = 40003,
  AUTH_FAILED = 40101,
  TOKEN_EXPIRED = 40102,
  FORBIDDEN = 40301,
  NOT_FOUND = 40401,
  
  INTERNAL_ERROR = 50001,
  DATABASE_ERROR = 50002,
  THIRD_PARTY_ERROR = 50003
}
```

## 前端类型生成

### 自动生成TypeScript类型

基于Swagger/OpenAPI自动生成：

```bash
# 使用openapi-typescript
npx openapi-typescript http://localhost:3000/docs/json --output types/api.ts

# 生成的类型文件
export interface paths {
  "/api/users": {
    get: {
      parameters: {
        query: {
          page?: number;
          pageSize?: number;
          status?: "active" | "inactive" | "banned";
          name?: string;
          createdAtStart?: string;
          createdAtEnd?: string;
          sort?: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["PaginatedUserResponse"];
          };
        };
      };
    };
  };
}
```

---

**总结**：本规范采用企业级标准，通过显式字段定义、完整的TypeScript类型支持、标准化的Swagger文档，为前后端协作提供了最佳实践。相比通用筛选方式，字段化筛选在类型安全、开发效率、维护性方面都有显著优势。