# 测试执行指南

## 简介

本文档提供了易山管理系统API测试用例的执行指南，帮助开发者快速了解如何运行测试、解读测试结果以及排除常见问题。

## 测试环境准备

在执行测试前，请确保您已完成以下准备工作：

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   - 复制 `.env.example` 为 `.env` 并根据实际环境修改配置
   - 确保数据库和Redis服务已正确配置（详见 `README.md`）

3. **准备测试数据库**
   ```bash
   # 运行数据库迁移
   npm run db:migrate
   
   # 运行数据库种子（创建默认测试数据）
   npm run db:seed
   ```

## 执行测试

### 运行所有测试

```bash
# 使用npm运行所有测试
npm test

# 或使用tsx直接运行
npx tsx --test test/**/*.test.ts
```

### 运行特定模块测试

```bash
# 运行认证模块测试
npx tsx --test test/auth.test.ts

# 运行管理员功能测试
npx tsx --test test/admin.test.ts

# 运行用户管理测试
npx tsx --test test/admin-users.test.ts
```

### 测试命令选项

```bash
# 显示详细测试输出
npx tsx --test --reporter=spec test/auth.test.ts

# 生成测试覆盖率报告
npx tsx --test --coverage test/**/*.test.ts

# 仅运行特定测试（使用grep模式）
npx tsx --test --grep="登录" test/auth.test.ts
```

## 测试报告解读

测试执行后，将输出类似以下格式的报告：

```
▶ Auth API Tests
  ▶ POST /api/v1/auth/login
    ✔ 应该成功使用用户名登录 (215.9382ms)
    ✔ 应该成功使用邮箱登录 (196.0672ms)
    ✔ 应该拒绝错误的密码 (181.9393ms)
    ...
  ✔ POST /api/v1/auth/login (605.2244ms)
  ...
✔ Auth API Tests (1784.2603ms)
ℹ tests 23
ℹ suites 5
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2092.3441
```

- ✔ 表示测试通过
- ✖ 表示测试失败
- ▶ 表示测试套件
- ℹ 提供测试统计信息

## 常见问题与故障排除

### 数据库连接错误

**问题**: 测试执行时出现数据库连接错误
**解决方案**:
- 检查 `.env` 文件中的数据库配置是否正确
- 确认MySQL服务是否正在运行
- 验证数据库用户权限是否足够

### 认证测试失败

**问题**: 认证相关测试失败，返回状态码不符合预期
**解决方案**:
- 检查 JWT 配置是否正确
- 确认 `jwt-auth.ts` 中的错误处理逻辑是否符合测试预期
- 验证测试用例中的预期状态码是否与实际实现一致

### 测试超时

**问题**: 测试执行时出现超时错误
**解决方案**:
- 增加测试超时时间：`npx tsx --test --timeout=10000 test/auth.test.ts`
- 检查是否有长时间运行的异步操作未正确处理

## 编写新测试

添加新测试时，请遵循以下最佳实践：

1. 在适当的测试文件中添加新的测试用例
2. 使用描述性的测试名称，清晰表达测试目的
3. 确保测试是独立的，不依赖于其他测试的执行结果
4. 添加完整的断言，验证状态码、响应体结构和业务码
5. 更新 `TEST_CASES_DOCUMENTATION.md` 文档，记录新增的测试用例

## 相关资源

- [测试环境配置指南](./README.md)
- [测试用例文档](./TEST_CASES_DOCUMENTATION.md)
- [Node.js Test Runner 文档](https://nodejs.org/api/test.html)