# 前端列表规范

## 1. 列表页面规范

### 1.1 命名规范

- 列表数据字段命名：使用 `list` 作为列表数据字段名
- 分页参数命名：使用 `page` 表示页码，`pageSize` 表示每页条数
- 排序参数命名：使用 `sortBy` 表示排序字段，`sortOrder` 表示排序方向（`asc`/`desc`）

### 1.2 请求处理规范

```typescript
// 参数命名规范化：current -> page
const { current, pageSize, ...restParams } = params;
const result = await getUserList({
  page: current,
  pageSize,
  ...restParams,
});
```

### 1.3 响应处理规范

- **完全依赖 `isSuccess` 字段**：前端判断操作是否成功时，必须使用 API 返回的 `isSuccess` 字段
- **统一错误处理**：错误信息直接使用 API 返回的 `message` 字段，不进行前端特殊处理

```typescript
// 严格按照规范处理响应
return {
  data: result.data?.list || [],
  // 使用isSuccess字段判断操作是否成功
  success: result.isSuccess === true,
  total: result.data?.pagination?.total || 0,
};
```

## 2. 列表组件规范

### 2.1 ProTable 组件使用规范

- 使用 `headerTitle` 设置表格标题
- 使用 `rowKey` 指定行唯一标识
- 使用 `search` 配置搜索表单
- 使用 `toolBarRender` 自定义工具栏
- 使用 `request` 处理数据请求和响应

### 2.2 按钮命名规范

- 新建按钮：使用 `新建` 而非 `新建xxx`
- 编辑按钮：使用 `编辑`
- 删除按钮：使用 `删除`
- 启用/禁用按钮：使用 `启用`/`禁用`

### 2.3 批量操作规范

- 批量操作按钮放置在表格顶部的选择提示中
- 常见批量操作：`批量删除`、`批量导出`

## 3. API 响应处理规范

### 3.1 响应结构

所有 API 响应都包含以下字段：
```typescript
interface ApiResponse<T = any> {
  code: number;        // 业务状态码
  message: string;     // 响应消息
  data?: T;           // 响应数据
  isSuccess: boolean; // 操作是否成功
}
```

### 3.2 列表数据结构

列表数据结构应符合以下格式：
```typescript
type sysUserListResponse = {
  list?: sysUser[];
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};
```

## 4. 最佳实践

### 4.1 正确的响应处理示例

```typescript
// ✅ 正确：完全依赖 isSuccess 字段
const handleApiResponse = async () => {
  const response = await apiCall();
  if (response.isSuccess) {
    // 处理成功逻辑
    message.success(response.message || '操作成功');
    return response.data;
  } else {
    // 处理失败逻辑
    message.error(response.message || '操作失败');
    return null;
  }
};
```

### 4.2 错误的响应处理示例

```typescript
// ❌ 错误：不要使用前端业务码判断
const handleApiResponseWrong = async () => {
  const response = await apiCall();
  if (BusinessCodeValidator.isSuccess(response.code)) { // 禁止这样做
    // ...
  }
};
```

### 4.3 列表页面示例

参考 `src/pages/system/user/index.tsx` 中的用户列表实现。