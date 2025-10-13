# 数据映射规范指南

## 概述

本文档定义了项目中数据映射的统一规范，提供了通用的、可扩展的数据转换解决方案。

## 设计原则

1. **通用性**: 提供通用的映射框架，支持任意实体类型
2. **可配置性**: 通过配置对象定义映射规则，而非硬编码
3. **可扩展性**: 新增实体类型时只需添加配置，无需修改核心逻辑
4. **向后兼容**: 保持现有API的兼容性
5. **类型安全**: 提供完整的TypeScript类型支持

## 核心工具

### naming-converter.ts

位置：`src/utils/naming-converter.ts`

提供以下核心功能：

#### 1. 命名转换
- `snakeToCamel(str)`: 下划线转驼峰
- `camelToSnake(str)`: 驼峰转下划线
- `convertKeysToCamel(obj)`: 对象属性名转驼峰
- `convertKeysToSnake(obj)`: 对象属性名转下划线

#### 2. 通用数据映射
- `convertUserToPublic(user)`: 用户数据映射
- `convertUsersToPublic(users)`: 用户列表映射
- `convertRoleToPublic(role)`: 角色数据映射
- `convertRolesToPublic(roles)`: 角色列表映射

#### 3. 工具函数
- `excludeKeys(obj, keysToExclude)`: 排除指定字段
- `deepConvertKeys(obj, converter)`: 深度转换对象键名

## 使用规范

### 1. Repository层数据映射

所有Repository都应该使用统一的映射方式：

```typescript
import { convertUserToPublic, convertRoleToPublic } from '../utils/naming-converter.js'

export class UserRepository {
  // 推荐方式：使用通用转换函数
  private toUserPublic(user: User): UserPublic {
    return convertUserToPublic(user) as UserPublic;
  }
}

export class RoleRepository {
  // 推荐方式：使用通用转换函数
  private mapToPublic(role: any): RolePublic {
    return convertRoleToPublic(role) as RolePublic;
  }
}
```

### 2. 新增实体映射

当需要为新的实体添加映射时，应该：

1. 在 `naming-converter.ts` 中添加对应的转换函数
2. 遵循现有的命名规范：`convert{Entity}ToPublic`
3. 处理特殊字段映射和敏感字段过滤

示例：
```typescript
/**
 * 转换产品对象为公开信息
 * @param product - 产品对象
 * @returns 转换后的产品公开信息
 */
export function convertProductToPublic(product: any): any {
  if (!product) return null;
  
  // 排除敏感字段
  const sensitiveFields = ['deleted_at', 'version', 'internal_notes'];
  const publicProduct = excludeKeys(product, sensitiveFields);
  
  // 特殊字段映射
  const mappedProduct = {
    ...publicProduct,
    name: product.product_name,
    description: product.product_desc,
    price: product.unit_price,
    // 其他特殊映射...
  };
  
  // 清理已重映射的字段
  delete mappedProduct.product_name;
  delete mappedProduct.product_desc;
  delete mappedProduct.unit_price;
  
  // 转换为驼峰命名
  return convertKeysToCamel(mappedProduct);
}
```

### 3. 字段映射规则

#### 标准映射
- 数据库字段（下划线）→ API字段（驼峰）
- `created_at` → `createdAt`
- `updated_at` → `updatedAt`
- `user_name` → `userName`

#### 特殊映射
某些字段需要特殊处理：
- `role_name` → `name` 和 `code`（角色名称同时作为编码）
- `is_system` → `type`（布尔值转枚举）
- `sort_order` → `sortOrder`（带默认值）

#### 敏感字段过滤
以下字段应该被自动过滤：
- `password_hash`
- `salt`
- `deleted_at`
- `version`
- 其他包含敏感信息的字段

## 最佳实践

### 1. Repository实现
```typescript
export class ExampleRepository {
  // ✅ 推荐：使用通用转换函数
  private mapToPublic(entity: any): EntityPublic {
    return convertEntityToPublic(entity) as EntityPublic;
  }
  
  // ❌ 不推荐：手动映射（除非有特殊需求）
  private mapToPublicManual(entity: any): EntityPublic {
    return {
      id: entity.id,
      name: entity.entity_name,
      // ... 大量手动映射代码
    };
  }
}
```

### 2. 批量数据处理
```typescript
// ✅ 推荐：使用批量转换函数
const result = {
  roles: convertRolesToPublic(roles),
  total,
  page,
  pageSize
};

// ❌ 不推荐：手动循环映射
const result = {
  roles: roles.map(role => this.mapToPublic(role)),
  total,
  page,
  pageSize
};
```

### 3. 类型安全
```typescript
// ✅ 推荐：明确类型转换
private mapToPublic(role: any): RolePublic {
  return convertRoleToPublic(role) as RolePublic;
}

// ❌ 不推荐：丢失类型信息
private mapToPublic(role: any) {
  return convertRoleToPublic(role);
}
```

## 迁移指南

### 现有代码迁移

1. **识别手动映射代码**
   - 查找包含大量字段映射的 `mapToPublic` 方法
   - 查找重复的字段转换逻辑

2. **添加通用转换函数**
   - 在 `naming-converter.ts` 中添加对应的转换函数
   - 处理特殊字段映射需求

3. **更新Repository**
   - 导入新的转换函数
   - 替换手动映射代码
   - 保持方法签名不变

4. **测试验证**
   - 运行单元测试
   - 验证API响应格式
   - 确保类型检查通过

### 示例迁移

**迁移前：**
```typescript
private mapToPublic(role: any): RolePublic {
  return {
    id: role.id,
    name: role.role_name,
    code: role.role_name,
    description: role.role_desc,
    type: role.is_system ? RoleType.SYSTEM : RoleType.CUSTOM,
    status: role.status,
    sortOrder: role.sort_order || 0,
    createdAt: role.created_at,
    updatedAt: role.updated_at
  }
}
```

**迁移后：**
```typescript
import { convertRoleToPublic } from '../utils/naming-converter.js'

private mapToPublic(role: any): RolePublic {
  return convertRoleToPublic(role) as RolePublic;
}
```

## 注意事项

1. **向后兼容性**：确保API响应格式保持一致
2. **性能考虑**：通用转换函数已优化，性能与手动映射相当
3. **错误处理**：转换函数会自动处理 null/undefined 输入
4. **扩展性**：新增字段映射时优先考虑通用性

## 相关文件

- `src/utils/naming-converter.ts` - 核心转换工具
- `src/repository/userRepository.ts` - 用户数据映射示例
- `src/repository/roleRepository.ts` - 角色数据映射示例
- `src/domain/*.ts` - 类型定义文件

---

*最后更新：2024年12月*