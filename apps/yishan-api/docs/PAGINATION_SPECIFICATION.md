# 分页查询规范文档

## 概述

本文档定义了移山项目中所有分页查询的标准规范，确保API接口的一致性和可维护性。

## 规范版本
- 版本：v1.0
- 创建时间：2024
- 适用范围：所有分页查询接口

## 请求规范

### 标准查询参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 | 限制 |
|--------|------|------|--------|------|------|
| page | number | 否 | 1 | 当前页码 | 必须 ≥ 1 |
| pageSize | number | 否 | 10 | 每页条数 | 1 ≤ pageSize ≤ 100 |
| sortBy | string | 否 | id | 排序字段 | 必须是有效字段 |
| sortOrder | string | 否 | desc | 排序方向 | asc 或 desc |
| search | string | 否 | - | 搜索关键词 | 最大长度255 |

### 参数验证规则

```typescript
const paginationSchema = {
  type: 'object',
  properties: {
    page: { 
      type: 'number', 
      minimum: 1, 
      default: 1,
      errorMessage: '页码必须大于等于1'
    },
    pageSize: { 
      type: 'number', 
      minimum: 1, 
      maximum: 100, 
      default: 10,
      errorMessage: '每页条数必须在1-100之间'
    },
    sortBy: { 
      type: 'string', 
      enum: ['id', 'created_at', 'updated_at', 'name'], 
      default: 'id',
      errorMessage: '排序字段无效'
    },
    sortOrder: { 
      type: 'string', 
      enum: ['asc', 'desc'], 
      default: 'desc',
      errorMessage: '排序方向必须是asc或desc'
    },
    search: { 
      type: 'string', 
      maxLength: 255,
      transform: ['trim']
    }
  }
}
```

## 响应规范

### 标准响应格式

```typescript
interface PaginationResponse<T> {
  code: number;           // 业务状态码
  message: string;        // 响应消息
  data: {
    list: T[];            // 数据列表
    pagination: {
      page: number;       // 当前页码
      pageSize: number;   // 每页条数
      total: number;      // 总记录数
      totalPages: number; // 总页数
    }
  }
}
```

### 示例响应

```json
{
  "code": 20060,
  "message": "分页查询成功",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "user1",
        "email": "user1@example.com",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 客户端判断逻辑
客户端可通过以下方式判断分页状态：
- **是否有下一页**: `page < totalPages`
- **是否有上一页**: `page > 1`
- **是否为空结果**: `total === 0`
- **是否为最后一页**: `page === totalPages`

## 实现规范

### 数据库查询规范 (Knex.js实现)

项目使用Knex.js作为SQL查询构建器，以下是基于Knex的分页查询规范：

#### 1. 总数查询
```typescript
// 使用Knex查询构建器，必须单独查询总数避免GROUP BY冲突
const countResult = await knex('users')
  .whereNull('deleted_at')
  .where('status', 'active')
  .modify((queryBuilder) => {
    if (search) {
      queryBuilder.where(function() {
        this.where('username', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`)
      })
    }
  })
  .count('* as count')
  .first()

const total = parseInt(countResult?.count as string)
```

#### 2. 数据查询
```typescript
const list = await knex('users')
  .select('id', 'username', 'email', 'created_at', 'updated_at')
  .whereNull('deleted_at')
  .where('status', 'active')
  .modify((queryBuilder) => {
    if (search) {
      queryBuilder.where(function() {
        this.where('username', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`)
          .orWhere('real_name', 'like', `%${search}%`)
      })
    }
  })
  .orderBy(sortBy, sortOrder)
  .limit(pageSize)
  .offset((page - 1) * pageSize)
```

#### 3. 事务支持的分页查询
```typescript
import { Knex } from 'knex'

async function findUsersWithTransaction(
  query: PaginationQuery,
  trx?: Knex.Transaction
): Promise<PaginationResult> {
  const db = trx || knex
  
  // 使用事务进行一致性查询
  const [countResult, data] = await Promise.all([
    db('users')
      .whereNull('deleted_at')
      .modify((qb) => applyFilters(qb, query))
      .count('* as count')
      .first(),
    
    db('users')
      .select(['id', 'username', 'email', 'real_name', 'created_at', 'updated_at'])
      .whereNull('deleted_at')
      .modify((qb) => applyFilters(qb, query))
      .orderBy(query.sortBy, query.sortOrder)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
  ])
  
  const total = parseInt(countResult?.count as string)
  return { data, total }
}

// 过滤器应用函数
function applyFilters(qb: Knex.QueryBuilder, query: PaginationQuery) {
  if (query.search) {
    qb.where(function() {
      this.where('username', 'like', `%${query.search}%`)
        .orWhere('email', 'like', `%${query.search}%`)
        .orWhere('real_name', 'like', `%${query.search}%`)
    })
  }
  
  if (query.status !== undefined) {
    qb.where('status', query.status)
  }
  
  if (query.startDate && query.endDate) {
    qb.whereBetween('created_at', [query.startDate, query.endDate])
  }
}
```

### 计算逻辑规范

```typescript
// 分页计算
const totalPages = Math.max(0, Math.ceil(total / pageSize))
const safePage = Math.max(1, Math.min(page, totalPages || 1))
```

### 服务层实现

```typescript
import { Knex } from 'knex'
import knex from '../database/knex'

class UserService {
  private readonly tableName = 'users'
  
  async findUsers(query: PaginationQuery): Promise<PaginationResponse<User>> {
    // 1. 参数验证和默认值设置
    const validatedQuery = this.validateQuery(query)
    
    // 2. 使用事务保证数据一致性
    const result = await knex.transaction(async (trx) => {
      // 3. 并行查询总数和数据列表
      const [countResult, data] = await Promise.all([
        // 总数查询
        trx(this.tableName)
          .whereNull('deleted_at')
          .modify((qb) => this.applyFilters(qb, validatedQuery))
          .count('* as count')
          .first(),
        
        // 数据查询
        trx(this.tableName)
          .select([
            'id', 'username', 'email', 'real_name', 
            'status', 'created_at', 'updated_at'
          ])
          .whereNull('deleted_at')
          .modify((qb) => this.applyFilters(qb, validatedQuery))
          .orderBy(validatedQuery.sortBy, validatedQuery.sortOrder)
          .limit(validatedQuery.pageSize)
          .offset((validatedQuery.page - 1) * validatedQuery.pageSize)
      ])
      
      const total = parseInt(countResult?.count as string) || 0
      const totalPages = Math.max(0, Math.ceil(total / validatedQuery.pageSize))
      
      return {
        data,
        pagination: {
          page: validatedQuery.page,
          pageSize: validatedQuery.pageSize,
          total,
          totalPages
        }
      }
    })
    
    return {
      code: 20000,
      message: '操作成功',
      data: result
    }
  }

  private validateQuery(query: any): Required<PaginationQuery> {
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 10))
    const sortBy = ['id', 'username', 'email', 'real_name', 'created_at', 'updated_at', 'status'].includes(query.sortBy) 
      ? query.sortBy 
      : 'id'
    const sortOrder = ['asc', 'desc'].includes(query.sortOrder) 
      ? query.sortOrder 
      : 'desc'
    
    return {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search: query.search?.trim()
    }
  }

  private applyFilters(qb: Knex.QueryBuilder, query: any): void {
    if (query.search) {
      qb.where(function() {
        this.where('username', 'like', `%${query.search}%`)
          .orWhere('email', 'like', `%${query.search}%`)
          .orWhere('real_name', 'like', `%${query.search}%`)
      })
    }
  }
}
```}]}

## 测试规范

### 单元测试

```typescript
import { knex } from 'knex'
import { mockDb } from 'mock-knex'

describe('UserService', () => {
  let service: UserService
  let db: knex

  beforeAll(() => {
    db = knex({
      client: 'sqlite3',
      connection: ':memory:'
    })
    mockDb.mock(db)
    service = new UserService(db)
  })

  afterAll(() => {
    mockDb.unmock(db)
    return db.destroy()
  })

  describe('getUsers', () => {
    it('should return paginated results', async () => {
      // 设置模拟数据
      const mockUsers = [
        { id: 1, username: 'user1', email: 'user1@example.com', created_at: new Date() },
        { id: 2, username: 'user2', email: 'user2@example.com', created_at: new Date() }
      ]
      
      // 模拟Knex查询
      const tracker = mockDb.getTracker()
      tracker.install()
      
      tracker.on('query', (query) => {
        if (query.sql.includes('count(*)')) {
          query.response([{ count: 100 }])
        } else {
          query.response(mockUsers)
        }
      })

      const result = await service.getUsers({
        page: 1,
        pageSize: 10,
        sortBy: 'created_at',
        sortOrder: 'desc'
      })

      expect(result.code).toBe(20000)
      expect(result.data.list).toEqual(mockUsers)
      expect(result.data.pagination.total).toBe(100)
      expect(result.data.pagination.page).toBe(1)
      expect(result.data.pagination.pageSize).toBe(10)
      expect(result.data.pagination.totalPages).toBe(10)
      
      tracker.uninstall()
    })

    it('should handle empty results', async () => {
      const tracker = mockDb.getTracker()
      tracker.install()
      
      tracker.on('query', (query) => {
        if (query.sql.includes('count(*)')) {
          query.response([{ count: 0 }])
        } else {
          query.response([])
        }
      })

      const result = await service.getUsers({
        page: 1,
        pageSize: 10
      })

      expect(result.code).toBe(20000)
      expect(result.data.list).toEqual([])
      expect(result.data.pagination.total).toBe(0)
      expect(result.data.pagination.totalPages).toBe(0)
      
      tracker.uninstall()
    })
  })
})
```

### 边界测试 (Knex.js版本)

```typescript
describe('分页边界测试', () => {
  let service: UserService
  let db: knex

  beforeAll(() => {
    db = knex({
      client: 'sqlite3',
      connection: ':memory:'
    })
    service = new UserService(db)
  })

  afterAll(() => {
    return db.destroy()
  })

  it('should handle pageSize = 0', async () => {
    const result = await service.getUsers({ page: 1, pageSize: 0 })
    expect(result.pagination.pageSize).toBe(10) // 使用默认值
  })

  it('should handle negative page', async () => {
    const result = await service.getUsers({ page: -1, pageSize: 10 })
    expect(result.pagination.page).toBe(1) // 修正为最小值
  })

  it('should handle pageSize > 100', async () => {
    const result = await service.getUsers({ page: 1, pageSize: 200 })
    expect(result.pagination.pageSize).toBe(100) // 限制最大值
  })

  it('should handle last page correctly', async () => {
    const tracker = mockDb.getTracker()
    tracker.install()
    
    tracker.on('query', (query) => {
      if (query.sql.includes('count(*)')) {
        query.response([{ count: 95 }])
      } else {
        query.response(Array(5).fill(null).map((_, i) => ({
          id: 91 + i,
          username: `user${91 + i}`,
          email: `user${91 + i}@example.com`,
          created_at: new Date()
        })))
      }
    })

    const result = await service.getUsers({ page: 10, pageSize: 10 })
    expect(result.pagination.page).toBe(10)
    expect(result.pagination.totalPages).toBe(10)
    
    tracker.uninstall()
  })
})
```

## 最佳实践

### 1. 性能优化
- 使用索引优化查询性能
- 避免在大量数据上使用LIKE '%keyword%'
- 考虑使用全文搜索替代模糊查询

### 2. 安全性
- 始终验证和清理用户输入
- 使用参数化查询防止SQL注入
- 限制最大页大小防止资源耗尽

### 3. 缓存策略
- 对静态数据使用Redis缓存
- 设置合理的缓存过期时间
- 实现缓存失效机制

### 4. 监控指标
- 查询响应时间
- 数据库查询次数
- 缓存命中率
- 错误率统计

## 技术栈说明
本项目使用以下技术栈实现分页功能：

- **数据库查询**: Knex.js (SQL查询构建器)
- **ORM**: 无 (直接使用Knex进行数据库操作)
- **框架**: Fastify.js
- **测试**: Jest + mock-knex (Knex测试工具)
- **类型系统**: TypeScript

## 相关文档
- [项目规范](PROJECT_SPECIFICATION.md) - 包含整体项目规范
- [响应状态码规范](RESPONSE_STATUS_CODE_SPECIFICATION.md) - 包含分页专用状态码
- [用户模块API文档](API_USER.md) - 分页规范应用示例
- [Knex.js官方文档](https://knexjs.org/)

## 更新记录
- **2024-12-25**: 技术栈更新：明确使用Knex.js作为数据库查询构建器，移除分页专用业务码，统一使用通用业务码
  - 将数据库查询规范从通用SQL更新为Knex.js专用实现
  - 增加Knex.js事务支持示例
  - 更新测试规范使用mock-knex
  - 增加Knex.js最佳实践和性能优化建议
- **2024-12-20**: 重大更新：符合企业级分页规范
  - 移除hasNext/hasPrev字段，简化响应结构
  - 统一使用list命名规范
  - 添加客户端判断逻辑说明
  - 完善参数验证规则
- **2024-12-15**: 添加性能优化建议
- **2024-12-01**: 初始版本发布