# Schema开发快速指南

## 新增业务模块Schema（3分钟完成）

### 步骤1：创建Schema文件
```bash
# 创建新的schema文件
touch src/schemas/[模块名].schema.ts
```

### 步骤2：定义Schema
```typescript
// src/schemas/product.schema.ts
import { Type } from '@sinclair/typebox'

// 基础Schema
export const sysProductSchema = Type.Object({
  id: Type.Integer(),
  name: Type.String(),
  price: Type.Number(),
  // ...其他字段
})

// 请求Schema
export const sysProductCreateRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  price: Type.Number({ minimum: 0 }),
})

// 响应Schema
export const sysProductListResponseSchema = Type.Object({
  items: Type.Array(sysProductSchema),
  total: Type.Integer(),
})
```

### 步骤3：注册Schema
```typescript
// src/plugins/external/schemas.ts
import {
  sysProductSchema,
  sysProductCreateRequestSchema,
  sysProductListResponseSchema,
  // ...导入其他schema
} from '../../schemas/product.schema.js'

// 在schemasPlugin函数中添加
fastify.addSchema(sysProductSchema)
fastify.addSchema(sysProductCreateRequestSchema)
fastify.addSchema(sysProductListResponseSchema)
```

### 步骤4：路由中使用
```typescript
// src/routes/api/v1/product.ts
export default async function productRoutes(fastify: FastifyInstance) {
  fastify.post('/', {
    schema: {
      body: { $ref: 'sysProductCreateRequest#' },
      response: {
        200: { $ref: 'sysProductListResponse#' }
      }
    }
  }, async (request, reply) => {
    // 业务逻辑
  })
}
```

## 命名检查清单

- [ ] Schema变量名：`sys[模块][功能][类型]Schema`
- [ ] $id命名：`sys[模块][功能][类型]`（去掉Schema后缀）
- [ ] 文件名：`[模块].schema.ts`
- [ ] 已导入到`plugins/external/schemas.ts`
- [ ] 已在路由文件中使用正确$ref引用

## 常见错误避免

1. **路径错误**：确保相对路径正确（`../../schemas/`）
2. **重复注册**：只在`plugins/external/schemas.ts`中注册一次
3. **命名不一致**：变量名、$id、文件名保持一致规范
4. **遗漏导入**：新增schema后记得在插件中导入和注册

## 验证步骤

```bash
# 1. 检查TypeScript编译
pnpm build

# 2. 启动开发服务器
pnpm dev

# 3. 访问Swagger文档验证
# http://localhost:3000/documentation
```