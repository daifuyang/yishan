# 测试环境配置指南

## 概述

本文档提供了易山管理系统API测试环境的详细配置说明，帮助开发者快速搭建和运行测试环境。

## 环境要求

### 系统要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 6.0
- PowerShell 5.0+ (Windows)

### 依赖安装
```bash
# 安装项目依赖
cd c:\Workspace\Frontend\yishan\apps\yishan-api
npm install
```

## 数据库配置

### MySQL数据库设置

1. **创建数据库**
```sql
CREATE DATABASE `yishan-admin` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **创建用户（可选）**
```sql
CREATE USER 'yishan'@'localhost' IDENTIFIED BY '123456';
GRANT ALL PRIVILEGES ON `yishan-admin`.* TO 'yishan'@'localhost';
FLUSH PRIVILEGES;
```

3. **运行数据库迁移**
```bash
# 运行数据库迁移
npm run db:migrate

# 运行数据库种子（创建默认管理员账户）
npm run db:seed
```

### Redis配置

确保Redis服务正在运行：
```bash
# Windows (如果使用Redis for Windows)
redis-server

# 或者使用Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

## 环境变量配置

### 方式一：使用.env文件（推荐）

测试会自动加载项目根目录的`.env`文件，无需额外配置。

**推荐做法**：
1. 复制项目根目录的`.env.example`文件为`.env`
2. 根据实际环境修改其中的配置值

```bash
# 在项目根目录执行
cp .env.example .env
```

然后编辑`.env`文件，确保包含测试所需的配置。关键配置项包括：

```env
# 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=yishan-admin

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 其他必要配置
COOKIE_SECRET=your-cookie-secret-change-this
CAN_SEED_DATABASE=true
DEFAULT_ADMIN_PASSWORD=your_admin_password
```

> ⚠️ **安全提醒**：
> - 请将上述示例中的占位符替换为实际的安全密码
> - 不要在文档或代码仓库中提交真实的密码
> - 建议使用强密码生成器生成复杂密码
> - 生产环境请使用更安全的密钥管理方案

### 方式二：系统环境变量（不推荐用于测试）

如果需要覆盖特定配置，可以在PowerShell中设置环境变量：
```powershell
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="your_mysql_password"
$env:MYSQL_DATABASE="yishan-admin"
$env:REDIS_HOST="localhost"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD="your_redis_password"
$env:REDIS_DB="0"
$env:JWT_SECRET="your_jwt_secret_key"
$env:JWT_EXPIRES_IN="24h"
$env:COOKIE_SECRET="your-cookie-secret-change-this"
$env:COOKIE_NAME="yishan-session"
$env:RATE_LIMIT_MAX="100"
$env:LOG_LEVEL="error"
```

## 测试数据准备

### 默认管理员账户

数据库种子脚本会创建以下默认管理员账户：
- **用户名**: `admin`
- **邮箱**: `admin@yishan.com`
- **密码**: `admin123`
- **状态**: 启用

### 创建测试用户（可选）

如果需要测试不同状态的用户，可以手动创建：

```sql
-- 创建禁用用户
INSERT INTO sys_user (username, email, password, salt, status, created_at, updated_at) 
VALUES ('disableduser', 'disabled@test.com', 'hashed_password', 'salt', 0, NOW(), NOW());

-- 创建锁定用户
INSERT INTO sys_user (username, email, password, salt, status, created_at, updated_at) 
VALUES ('lockeduser', 'locked@test.com', 'hashed_password', 'salt', 2, NOW(), NOW());
```

## 运行测试

### 单个测试文件
```bash
cd c:\Workspace\Frontend\yishan\apps\yishan-api\test
npx tsx --test auth.test.ts
```

### 运行所有测试
```bash
# 如果有多个测试文件
npx tsx --test *.test.ts
```

### 详细输出
```bash
npx tsx --test --reporter=verbose auth.test.ts
```

## 测试配置说明

### 测试环境变量

测试运行时会自动设置以下环境变量：
```javascript
process.env.NODE_ENV = 'test'           // 设置为测试环境
process.env.LOG_LEVEL = 'error'         // 减少日志输出
```

### Fastify应用配置

测试中的Fastify应用配置：
```javascript
const app = Fastify({ 
  logger: false  // 禁用日志输出，避免测试输出混乱
})
```

## 故障排除

### 常见问题

#### 1. 数据库连接失败
**错误**: `ECONNREFUSED` 或 `Access denied`
**解决方案**:
- 检查MySQL服务是否运行
- 验证数据库连接参数
- 确认用户权限

#### 2. Redis连接失败
**错误**: `Redis connection failed`
**解决方案**:
- 检查Redis服务是否运行
- 验证Redis连接参数
- 检查防火墙设置

#### 3. 测试数据不存在
**错误**: 测试返回"用户不存在"
**解决方案**:
- 运行数据库种子：`npm run db:seed`
- 检查`CAN_SEED_DATABASE`环境变量
- 手动创建测试用户

#### 4. JWT密钥错误
**错误**: `JsonWebTokenError`
**解决方案**:
- 检查`JWT_SECRET`环境变量
- 确保密钥长度足够

### 调试技巧

#### 启用详细日志
```javascript
// 在测试文件中临时启用日志
process.env.LOG_LEVEL = 'debug'
const app = Fastify({ logger: true })
```

#### 检查环境变量
```javascript
// 在测试开始前打印环境变量
console.log('Environment variables:', {
  MYSQL_HOST: process.env.MYSQL_HOST,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  REDIS_HOST: process.env.REDIS_HOST
})
```

#### 数据库查询调试
```sql
-- 检查用户表数据
SELECT * FROM sys_user;

-- 检查用户状态
SELECT username, email, status FROM sys_user WHERE username = 'admin';
```

## 持续集成配置

### GitHub Actions示例

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: 123456
          MYSQL_DATABASE: yishan-admin
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
      
      redis:
        image: redis:latest
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run db:migrate
      - run: npm run db:seed
      - run: npm test
        env:
          MYSQL_HOST: localhost
          MYSQL_PORT: 3306
          MYSQL_USER: root
          MYSQL_PASSWORD: 123456
          MYSQL_DATABASE: yishan-admin
          REDIS_HOST: localhost
          REDIS_PORT: 6379
```

## 最佳实践

### 测试隔离
- 每个测试用例使用独立的数据
- 测试完成后清理临时数据
- 避免测试之间的相互依赖

### 性能优化
- 使用内存数据库进行快速测试
- 并行运行独立的测试用例
- 合理设置超时时间

### 安全考虑
- 不在测试代码中硬编码敏感信息
- 使用专门的测试环境
- 定期更新测试依赖

## 相关文档

- [测试用例文档](./TEST_CASES_DOCUMENTATION.md)
- [API文档](../docs/)
- [数据库迁移指南](../migrations/)
- [环境配置指南](../docs/ENV_CONFIGURATION_GUIDE.md)