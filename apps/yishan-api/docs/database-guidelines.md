# 依山 API 数据库设计规范

## 数据库设计原则

### 设计目标
- 数据一致性
- 查询性能优化
- 可扩展性
- 易于维护

### 设计规范
- 遵循第三范式 (3NF)
- 使用适当的数据类型
- 添加必要的索引
- 避免数据冗余

## 数据库结构

### 当前数据库
- **主数据库**: MySQL 8.0+
- **缓存数据库**: Redis 6.0+
- **连接池**: 使用 Knex.js 连接池

### 表命名规范

#### 基本规则
- 使用小写字母
- 使用下划线分隔单词
- 使用复数形式
- 避免保留字

#### 示例
```sql
-- 正确
users, user_profiles, user_roles

-- 错误
User, userProfile, user-role
```

### 字段命名规范

#### 基本规则
- 使用小写字母和下划线
- 避免缩写
- 使用描述性名称
- 外键使用 `{table}_id` 格式

#### 标准字段
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
deleted_at      TIMESTAMP NULL DEFAULT NULL  -- 软删除
is_active       BOOLEAN DEFAULT TRUE
```

## 数据类型规范

### 字符串类型

| 类型 | 长度 | 用途 |
|------|------|------|
| VARCHAR(255) | 可变长度 | 用户名、邮箱、标题 |
| TEXT | 最大64KB | 描述、内容 |
| MEDIUMTEXT | 最大16MB | 长文本内容 |
| CHAR(32) | 固定长度 | UUID、哈希值 |

### 数值类型

| 类型 | 范围 | 用途 |
|------|------|------|
| INT | -2^31 到 2^31-1 | 主键、计数器 |
| BIGINT | -2^63 到 2^63-1 | 大整数、时间戳 |
| DECIMAL(10,2) | 精确小数 | 金额、价格 |
| FLOAT | 近似值 | 评分、比例 |

### 时间类型

| 类型 | 格式 | 用途 |
|------|------|------|
| DATETIME | YYYY-MM-DD HH:MM:SS | 绝对时间 |
| TIMESTAMP | Unix时间戳 | 相对时间、自动更新 |
| DATE | YYYY-MM-DD | 日期 |
| TIME | HH:MM:SS | 时间 |

## 表结构设计

### 用户表 (users)

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
);
```

### 用户配置表 (user_profiles)

```sql
CREATE TABLE user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  bio TEXT,
  birth_date DATE,
  location VARCHAR(255),
  website VARCHAR(500),
  social_links JSON,
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_id (user_id)
);
```

### 任务表 (tasks)

```sql
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  due_date DATETIME,
  completed_at TIMESTAMP NULL,
  tags JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_due_date (due_date),
  INDEX idx_created_at (created_at),
  FULLTEXT idx_title_description (title, description)
);
```

### 标签表 (tags)

```sql
CREATE TABLE tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#000000',
  description VARCHAR(500),
  is_system BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_is_system (is_system)
);
```

### 任务标签关联表 (task_tags)

```sql
CREATE TABLE task_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE KEY uk_task_tag (task_id, tag_id),
  INDEX idx_task_id (task_id),
  INDEX idx_tag_id (tag_id)
);
```

### 用户会话表 (user_sessions)

```sql
CREATE TABLE user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  device_info JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_session_token (session_token),
  INDEX idx_refresh_token (refresh_token),
  INDEX idx_expires_at (expires_at)
);
```

## 索引设计规范

### 主键索引
- 所有表必须有主键
- 使用自增整数作为主键

### 唯一索引
- 邮箱、用户名等唯一字段
- 组合唯一索引

### 普通索引
- 外键字段
- 经常查询的字段
- 排序字段

### 复合索引
```sql
-- 复合索引示例
CREATE INDEX idx_user_status_date ON tasks(user_id, status, due_date);
```

### 全文索引
```sql
-- MySQL 全文索引
ALTER TABLE tasks ADD FULLTEXT(title, description);
```

## 迁移规范

### 文件命名
```
{版本号}.{操作}.{描述}.sql
```

#### 示例
```
001.do.create-users.sql
001.undo.drop-users.sql
002.do.add-user-indexes.sql
002.undo.remove-user-indexes.sql
```

### 迁移内容模板

#### 创建表迁移
```sql
-- 001.do.create-users.sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_username ON users(username);
```

#### 回滚迁移
```sql
-- 001.undo.create-users.sql
DROP TABLE IF EXISTS users;
```

### 数据迁移
```sql
-- 添加新列并填充数据
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

UPDATE users SET full_name = CONCAT(first_name, ' ', last_name)
WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
```

## 数据完整性

### 外键约束
```sql
-- 外键约束示例
ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;
```

### 检查约束
```sql
-- 检查约束示例
ALTER TABLE users 
ADD CONSTRAINT chk_email_format 
CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
```

### 默认值约束
```sql
-- 默认值示例
ALTER TABLE tasks 
ALTER COLUMN status SET DEFAULT 'pending';
```

## 性能优化

### 查询优化

#### 使用索引
```sql
-- 使用索引的查询
EXPLAIN SELECT * FROM users WHERE email = 'user@example.com';
```

#### 避免全表扫描
```sql
-- 优化前 (全表扫描)
SELECT * FROM tasks WHERE DATE(created_at) = '2024-01-01';

-- 优化后 (使用索引)
SELECT * FROM tasks 
WHERE created_at >= '2024-01-01 00:00:00' 
AND created_at < '2024-01-02 00:00:00';
```

### 连接优化

#### 使用连接池
```javascript
// Knex.js 连接池配置
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    // 连接配置
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  }
});
```

### 缓存策略

#### Redis 缓存键设计
```
users:{id}           # 用户详情缓存
users:list:{query}   # 用户列表缓存
tasks:{id}           # 任务详情缓存
tasks:user:{user_id} # 用户任务缓存
```

#### 缓存更新策略
```sql
-- 数据变更时清除相关缓存
-- 在用户创建后清除用户列表缓存
DELETE FROM redis WHERE key LIKE 'users:list:%';
```

## 备份和恢复

### 备份策略
- 每日全量备份
- 每小时增量备份
- 保留30天备份
- 异地存储

### 备份脚本
```bash
#!/bin/bash
# 数据库备份脚本
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u username -p database_name > backup_${DATE}.sql
gzip backup_${DATE}.sql
```

### 恢复脚本
```bash
#!/bin/bash
# 数据库恢复脚本
gunzip backup_20240101_120000.sql.gz
mysql -u username -p database_name < backup_20240101_120000.sql
```

## 监控和告警

### 监控指标
- 查询响应时间
- 慢查询数量
- 连接数
- 磁盘使用率
- 内存使用率

### 慢查询日志
```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
```

### 性能分析
```sql
-- 使用 EXPLAIN 分析查询
EXPLAIN SELECT * FROM tasks 
WHERE user_id = 1 AND status = 'pending' 
ORDER BY due_date ASC;
```

## 安全规范

### 数据安全
- 敏感数据加密存储
- 使用参数化查询防止SQL注入
- 定期更新数据库补丁
- 限制数据库访问权限

### 访问控制
```sql
-- 创建专用用户
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON yishan.* TO 'app_user'@'localhost';
```

## 开发工作流

### 数据库变更流程
1. 创建迁移文件
2. 本地测试迁移
3. 代码审查
4. 预发布环境测试
5. 生产环境部署

### 测试数据
```sql
-- 创建测试数据
INSERT INTO users (email, username, password) VALUES
('test1@example.com', 'testuser1', 'hashed_password_1'),
('test2@example.com', 'testuser2', 'hashed_password_2'),
('test3@example.com', 'testuser3', 'hashed_password_3');
```

## 故障排除

### 常见问题

#### 连接超时
```sql
-- 检查连接数
SHOW PROCESSLIST;

-- 检查连接配置
SHOW VARIABLES LIKE 'max_connections%';
```

#### 查询慢
```sql
-- 查看慢查询
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

-- 分析表统计信息
ANALYZE TABLE users;
```

#### 死锁
```sql
-- 查看死锁日志
SHOW ENGINE INNODB STATUS;

-- 优化事务
-- 保持事务简短
-- 按相同顺序访问资源
```

## 最佳实践

### 设计建议
1. 提前规划索引策略
2. 使用适当的数据类型
3. 避免NULL值（使用默认值）
4. 规范化数据设计
5. 定期分析和优化表

### 查询建议
1. 使用EXPLAIN分析查询
2. 避免SELECT *
3. 使用LIMIT限制结果集
4. 优化JOIN操作
5. 使用批量操作

### 维护建议
1. 定期更新统计信息
2. 监控磁盘空间
3. 定期备份
4. 测试恢复流程
5. 记录变更历史

---

*最后更新: 2024年*
*数据库版本: MySQL 8.0+*