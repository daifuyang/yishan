---
title: 业务码与响应规范
---

# 业务码与响应规范

系统以内置业务码统一管理错误与状态，响应格式保持一致，便于前端处理。

## 响应格式

成功：
```json
{
  "success": true,
  "code": 10000,
  "message": "操作成功",
  "data": {},
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

错误：
```json
{
  "success": false,
  "code": 21001,
  "message": "参数错误",
  "data": null,
  "error": "详细错误信息",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 业务码工具

`packages/core/api/src/constants/business-codes/index.ts` 聚合业务码，并通过公开 `@yishan/core-api/business-codes` 提供工具类 `BusinessCode`：

- `getMessage(code)` 获取错误消息
- `getHttpStatus(code)` 映射到合适的 HTTP 状态码
- `isSuccess(code)` 判断是否为成功码

## 响应工具

公开 `@yishan/core-api/response` 的 `ResponseUtil` 定义 `success`、`paginated`、`error` 三类响应，统一输出结构与时间戳。

前端严格使用 `success` 字段判断是否成功，避免自行解析业务码。
