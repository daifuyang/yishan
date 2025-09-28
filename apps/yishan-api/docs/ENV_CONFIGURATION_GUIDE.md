# .env 配置指南

本指南详细说明了 yishan-api 项目中 `.env` 文件的配置项，基于项目实际使用的环境变量。

## 快速开始

1. 复制 `.env.example` 文件为 `.env`
2. 根据环境修改对应的配置值
3. 确保 `.env` 文件已添加到 `.gitignore`

```bash
cp .env.example .env
```

## 环境变量说明

### 1. 服务器配置

| 变量名 | 描述 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 服务器端口 | `3000` | Fastify 服务器监听的端口号 |
| `NODE_ENV` | 运行环境 | `development` | `development`, `production`, `test` |
| `HOST` | 服务器主机地址 | `localhost` | 用于 CORS 配置的主机地址 |
| `FASTIFY_CLOSE_GRACE_DELAY` | 优雅关闭延迟 | `1000` | 服务器关闭时的等待时间（毫秒） |
| `LOG_LEVEL` | 日志级别 | `info` | Fastify 日志级别：`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |

### 2. 数据库配置

#### MySQL 配置
```bash
# 数据库连接
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=yishan-admin
MYSQL_USER=root
MYSQL_PASSWORD=123456
```

#### 数据库安全控制
```bash
# 数据库操作权限（生产环境建议设为 0）
CAN_CREATE_DATABASE=0    # 是否允许创建数据库（0=禁止，1=允许）
CAN_DROP_DATABASE=0      # 是否允许删除数据库（0=禁止，1=允许）
CAN_SEED_DATABASE=0      # 是否允许种子数据填充（0=禁止，1=允许）
```

### 3. 安全配置

#### JWT 配置
```bash
# JWT 密钥（生产环境必须修改！）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

#### Cookie 配置
```bash
# Cookie 安全设置
COOKIE_SECRET=your-secret-key-here-change-this
COOKIE_NAME=yishan-session
COOKIE_SECURED=false    # 生产环境设为 true（HTTPS）
```

#### 速率限制
```bash
# API 速率限制
RATE_LIMIT_MAX=100      # 每分钟最大请求数
```

### 4. 文件上传配置

```bash
# 上传目录配置
UPLOAD_DIRNAME=uploads              # 通用上传文件目录
UPLOAD_TASKS_DIRNAME=tasks          # 任务相关文件上传目录
```

### 5. Redis 缓存配置（可选）

```bash
# Redis 连接
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                     # 如无密码请留空
REDIS_DB=0                          # Redis 数据库编号
CACHE_TTL=3600                      # 缓存过期时间（秒）
```

### 6. CORS 配置

```bash
# 允许的跨域来源（多个用逗号分隔）
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 7. 系统管理配置

```bash
# 系统清理 API 密钥（生产环境必须修改）
CLEANUP_API_KEY=your-cleanup-api-key-change-this-in-production

# 默认管理员密码（仅初始化时使用）
DEFAULT_ADMIN_PASSWORD=admin123
```

## 环境特定配置

### 开发环境 (.env.development)
```bash
NODE_ENV=development
PORT=3000
HOST=localhost

# 开发数据库
MYSQL_DATABASE=yishan-dev
CAN_CREATE_DATABASE=1
CAN_SEED_DATABASE=1

# 开发安全配置
COOKIE_SECURED=false
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Redis 开发配置
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=3600

# 系统管理
CLEANUP_API_KEY=dev-cleanup-key
DEFAULT_ADMIN_PASSWORD=admin123
```

### 生产环境 (.env.production)
```bash
NODE_ENV=production
PORT=80
HOST=0.0.0.0

# 生产数据库
MYSQL_DATABASE=yishan-prod
CAN_CREATE_DATABASE=0
CAN_SEED_DATABASE=0

# 生产安全配置
COOKIE_SECURED=true
JWT_EXPIRES_IN=1h
JWT_SECRET=your-production-jwt-secret-key
COOKIE_SECRET=your-production-cookie-secret
ALLOWED_ORIGINS=https://your-domain.com

# Redis 生产配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
CACHE_TTL=7200

# 系统管理
CLEANUP_API_KEY=your-production-cleanup-key
DEFAULT_ADMIN_PASSWORD=your-secure-admin-password
```

### 测试环境 (.env.test)
```bash
NODE_ENV=test
PORT=3001
HOST=localhost

# 测试数据库
MYSQL_DATABASE=yishan-test
CAN_CREATE_DATABASE=0
CAN_SEED_DATABASE=0

# 测试安全配置
COOKIE_SECURED=true
JWT_EXPIRES_IN=2h
ALLOWED_ORIGINS=http://localhost:3001

# Redis 测试配置
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=1800

# 系统管理
CLEANUP_API_KEY=test-cleanup-key
DEFAULT_ADMIN_PASSWORD=test123
```

## 安全配置检查清单

### 生产环境必备
- [ ] JWT_SECRET 使用至少 32 位的随机字符串
- [ ] COOKIE_SECRET 使用强随机密钥
- [ ] MySQL 密码使用强密码
- [ ] COOKIE_SECURED 设为 true（HTTPS 环境）
- [ ] 所有数据库权限设为 0（禁止操作）
- [ ] 使用专用的生产数据库用户

### 敏感信息处理
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 生产环境密钥存储在环境变量中，而非代码库
- [ ] 定期轮换 JWT_SECRET 和 COOKIE_SECRET
- [ ] 使用密钥管理服务存储敏感信息

## 常见问题

### 1. MySQL 连接失败
确保 MySQL 服务正在运行，并且用户具有相应权限：
```bash
# 检查 MySQL 状态
systemctl status mysql

# 创建数据库
CREATE DATABASE IF NOT EXISTS `yishan-admin`;

# 授权用户
GRANT ALL PRIVILEGES ON `yishan-admin`.* TO 'root'@'localhost';
```

### 2. Redis 连接失败
如果未使用 Redis，可以留空相关配置或安装 Redis：
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

### 3. 端口冲突
如果端口被占用，修改 PORT 配置：
```bash
PORT=3001
```

### 4. 上传目录权限
确保上传目录存在且有写入权限：
```bash
mkdir -p uploads tasks
chmod 755 uploads tasks
```

## 验证配置

创建验证脚本来检查配置：

```javascript
// config-validator.js
require('dotenv').config();

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'JWT_SECRET',
  'COOKIE_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('缺少必需的环境变量:');
  missingVars.forEach(varName => console.error(`- ${varName}`));
  process.exit(1);
}

console.log('✅ 所有必需的环境变量已配置');
```

## 更新日志

- v1.0.0: 初始版本，基于项目实际配置
- v1.0.1: 补充 Redis 配置说明
- v1.0.2: 添加各环境配置示例

## 相关文档

- [项目规范](./PROJECT_SPECIFICATION.md)
- [状态码规范](./RESPONSE_STATUS_CODE_SPECIFICATION.md)
- [数据库设计](./database/企业级数据库设计文档.md)