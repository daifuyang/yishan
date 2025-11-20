# 字典数据规范

本文档定义了 yishan-admin 项目中使用的字典数据规范，确保前后端字典数据的一致性。

## 概述

项目采用统一的字典数据管理方案：
- 前端不定义硬编码的枚举值
- 所有枚举数据从后端字典接口获取
- 通过约定的 key 来访问特定字典类型
- 字典数据在应用初始化时一次性获取，避免重复请求

## 字典接口

### 获取全部字典数据映射

**接口地址**: `GET /api/v1/admin/dicts/data/map`

**返回格式**:
```typescript
{
  code: number;
  message: string;
  success: boolean;
  data: Record<string, Array<{ label: string; value: string }>>;
  timestamp: string;
}
```

**使用方式**:
```typescript
// 在组件中获取字典数据
const { initialState } = useModel('@@initialState');
const dictDataMap = initialState?.dictDataMap || {};

// 获取特定字典类型
const userStatusDict = dictDataMap.user_status || [];
```

## 字典键名规范

### 用户管理模块

#### 用户状态字典
- **键名**: `user_status`
- **用途**: 用户状态管理（启用/禁用/锁定）
- **值类型**: `"0" | "1" | "2"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用  
  - `"2"`: 锁定

#### 用户性别字典
- **键名**: `user_gender`
- **用途**: 用户性别选择
- **值类型**: `"0" | "1" | "2"`（字符串）
- **值说明**:
  - `"0"`: 未知
  - `"1"`: 男
  - `"2"`: 女

### 部门管理模块

#### 部门状态字典
- **键名**: `dept_status`
- **用途**: 部门状态管理
- **值类型**: `"0" | "1"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用

### 角色管理模块

#### 角色状态字典
- **键名**: `role_status`
- **用途**: 角色状态管理
- **值类型**: `"0" | "1"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用

#### 通用状态字典
- **键名**: `default_status`
- **用途**: 通用状态管理（适用于角色、部门、岗位等）
- **值类型**: `"0" | "1"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用

### 岗位管理模块

#### 岗位状态字典
- **键名**: `post_status`
- **用途**: 岗位状态管理
- **值类型**: `"0" | "1"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用

### 菜单管理模块

#### 菜单类型字典
- **键名**: `menu_type`
- **用途**: 菜单类型区分
- **值类型**: `"0" | "1" | "2"`（字符串）
- **值说明**:
  - `"0"`: 目录
  - `"1"`: 菜单
  - `"2"`: 按钮

#### 菜单状态字典
- **键名**: `menu_status`
- **用途**: 菜单状态管理
- **值类型**: `"0" | "1"`（字符串）
- **值说明**:
  - `"0"`: 禁用
  - `"1"`: 启用

## 前端使用示例

### 在列表页面中使用

```typescript
import { useModel } from '@umijs/max';

const UserList: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  
  // 获取用户状态字典
  const userStatusDict = dictDataMap.user_status || [];
  
  // 表格列定义
  const columns: ProColumns<API.sysUser>[] = [
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: userStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = {
          text: item.label,
          status: item.value === "1" ? "Success" : item.value === "2" ? "Warning" : "Error"
        };
        return acc;
      }, {}),
    },
  ];
};
```

### 在表单中使用

```typescript
import { useModel } from '@umijs/max';

const UserForm: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  
  // 获取性别字典
  const genderDict = dictDataMap.user_gender || [];
  
  return (
    <ProFormRadio.Group
      name="gender"
      label="用户性别"
      options={genderDict}
    />
  );
};
```

### 状态切换逻辑

```typescript
const handleStatusChange = async (id: number, status: string) => {
  // 从启用切换到禁用，或从禁用切换到启用
  const newStatus = status === "1" ? "0" : "1";
  const res = await updateUser({ id }, { status: newStatus as "0" | "1" | "2" });
  
  if (res.success) {
    message.success(res.message);
    actionRef.current?.reload();
  }
};
```

## 后端字典数据要求

### 数据结构

后端返回的字典数据应符合以下格式：

```json
{
  "user_status": [
    { "label": "启用", "value": "1" },
    { "label": "禁用", "value": "0" },
    { "label": "锁定", "value": "2" }
  ],
  "user_gender": [
    { "label": "未知", "value": "0" },
    { "label": "男", "value": "1" },
    { "label": "女", "value": "2" }
  ]
}
```

### 数据要求

1. **值类型**: 所有字典值必须为字符串类型
2. **排序**: 字典项应按业务逻辑合理排序
3. **状态**: 只返回启用的字典项（除非特别需要）
4. **一致性**: 前后端字典键名必须保持一致

## 最佳实践

### 1. 键名命名规范
- 使用蛇形命名法（snake_case）
- 格式：`模块_字段`（如：`user_status`）
- 保持简洁且语义明确

### 2. 类型安全
- 前端使用正确的 TypeScript 类型定义
- 与后端 API 类型定义保持一致
- 避免硬编码枚举值

### 3. 性能优化
- 字典数据在应用初始化时一次性获取
- 避免在组件中重复请求字典数据
- 使用全局状态管理字典数据

### 4. 错误处理
- 字典数据为空时提供默认值
- 处理字典项查找失败的情况
- 记录字典数据获取失败日志

## 维护说明

1. **新增字典**: 在本文档中添加新的字典键名和说明
2. **修改字典**: 更新本文档中的相关说明
3. **废弃字典**: 在本文档中标记为废弃，并说明替代方案
4. **版本管理**: 记录字典规范的版本变更历史

---

**文档版本**: v1.0  
**最后更新**: 2024年  
**维护人员**: 开发团队