# 依山 API 测试规范文档

## 测试策略概述

### 测试金字塔
```
         /\
        /  \
       / E2E \    (少量)
      /--------\
     /    API    \  (适量)
    /------------\
   /   Unit Test   \ (大量)
  /________________\
```

### 测试覆盖率目标
- **单元测试**: 80%+
- **集成测试**: 70%+
- **端到端测试**: 关键业务流程
- **总覆盖率**: 75%+

## 测试环境

### 测试层级

#### 1. 单元测试 (Unit Tests)
- **范围**: 单个函数、类、模块
- **工具**: Node.js 内置测试框架
- **速度**: 毫秒级
- **依赖**: 无外部依赖 (mock/stub)

#### 2. 集成测试 (Integration Tests)
- **范围**: 数据库集成、API端点
- **工具**: 测试数据库 + Fastify 测试助手
- **速度**: 秒级
- **依赖**: 测试数据库

#### 3. 端到端测试 (E2E Tests)
- **范围**: 完整业务流程
- **工具**: 自动化测试工具
- **速度**: 分钟级
- **依赖**: 完整环境

### 测试数据库

#### 配置测试数据库
```javascript
// test/config/database.js
export const testDatabase = {
  client: 'mysql2',
  connection: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 3306,
    user: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'yishan_test'
  },
  pool: {
    min: 1,
    max: 5
  },
  migrations: {
    directory: './migrations'
  }
};
```

#### 测试数据清理
```javascript
// test/helpers/database.js
export async function cleanDatabase() {
  const tables = ['task_tags', 'tasks', 'user_sessions', 'users', 'tags'];
  
  for (const table of tables) {
    await knex(table).del();
  }
}

export async function seedTestData() {
  // 插入测试数据
  const [userId] = await knex('users').insert({
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed_password'
  });
  
  return { userId };
}
```

## 单元测试

### 测试结构
```
test/
├── unit/
│   ├── services/
│   ├── repository/
│   └── utils/
├── integration/
│   ├── routes/
│   └── database/
└── e2e/
    └── workflows/
```

### 服务层测试

#### UserService 测试示例
```typescript
// test/unit/services/userService.test.ts
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { UserService } from '../../../src/services/userService.js';
import { UserRepository } from '../../../src/repository/userRepository.js';

// Mock 依赖
const mockFastify = {
  knex: {},
  redis: {},
  passwordManager: {
    hash: async (password: string) => `hashed_${password}`,
    verify: async (password: string, hash: string) => hash === `hashed_${password}`
  }
};

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: any;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: async () => null,
      create: async (data: any) => ({ id: 1, ...data }),
      findById: async (id: number) => id === 1 ? { id: 1, email: 'test@test.com' } : null,
      update: async () => ({ id: 1 }),
      delete: async () => true
    };
    
    userService = new UserService(mockFastify as any);
    (userService as any).userRepository = mockUserRepository;
  });

  describe('createUser', () => {
    test('应该创建新用户', async () => {
      const userData = {
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123'
      };

      const result = await userService.createUser(userData);

      assert.strictEqual(result.email, userData.email);
      assert.strictEqual(result.username, userData.username);
      assert(!('password' in result));
    });

    test('应该抛出重复邮箱错误', async () => {
      mockUserRepository.findByEmail = async () => ({ id: 1 });
      
      const userData = {
        email: 'existing@example.com',
        username: 'testuser',
        password: 'password123'
      };

      await assert.rejects(
        async () => await userService.createUser(userData),
        /already exists/
      );
    });
  });

  describe('getUserById', () => {
    test('应该返回用户详情', async () => {
      const result = await userService.getUserById(1);
      
      assert.strictEqual(result?.id, 1);
      assert.strictEqual(result?.email, 'test@test.com');
    });

    test('应该返回 null 当用户不存在', async () => {
      const result = await userService.getUserById(999);
      
      assert.strictEqual(result, null);
    });
  });
});
```

### Repository 测试

#### UserRepository 测试示例
```typescript
// test/unit/repository/userRepository.test.ts
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { UserRepository } from '../../../src/repository/userRepository.js';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockKnex: any;
  let mockRedis: any;

  beforeEach(() => {
    mockKnex = {
      insert: async () => [1],
      where: () => ({
        first: async () => ({ id: 1, email: 'test@test.com' }),
        select: () => ({
          orderBy: async () => [{ id: 1 }, { id: 2 }]
        })
      }),
      del: async () => 1
    };
    
    mockRedis = {
      get: async () => null,
      setex: async () => {},
      keys: async () => [],
      del: async () => {}
    };

    userRepository = new UserRepository({ knex: mockKnex, redis: mockRedis } as any);
  });

  test('应该创建用户并返回数据', async () => {
    const userData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashed_password'
    };

    const result = await userRepository.create(userData);
    
    assert.strictEqual(result.id, 1);
    assert.strictEqual(result.email, 'test@test.com');
  });
});
```

## 集成测试

### API 端点测试

#### 用户路由测试
```typescript
// test/integration/routes/users.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import userRoutes from '../../../src/routes/users.js';
import { cleanDatabase, seedTestData } from '../helpers/database.js';

describe('User Routes', () => {
  let fastify: any;

  before(async () => {
    fastify = Fastify();
    await fastify.register(userRoutes);
    
    // 注册测试数据库
    fastify.register(require('fastify-knex'), {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        user: 'test_user',
        password: 'test_password',
        database: 'yishan_test'
      }
    });
  });

  after(async () => {
    await cleanDatabase();
    await fastify.close();
  });

  describe('POST /users', () => {
    test('应该创建新用户并返回201', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'new@example.com',
          username: 'newuser',
          password: 'password123'
        }
      });

      assert.strictEqual(response.statusCode, 201);
      
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.message, 'User created successfully');
      assert.strictEqual(data.user.email, 'new@example.com');
    });

    test('应该返回409当邮箱已存在', async () => {
      // 先创建一个用户
      await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'existing@example.com',
          username: 'existinguser',
          password: 'password123'
        }
      });

      // 尝试创建重复邮箱的用户
      const response = await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'existing@example.com',
          username: 'anotheruser',
          password: 'password123'
        }
      });

      assert.strictEqual(response.statusCode, 409);
      
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.error, 'Conflict');
    });
  });

  describe('GET /users', () => {
    test('应该返回用户列表', async () => {
      // 创建测试数据
      await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'test1@example.com',
          username: 'testuser1',
          password: 'password123'
        }
      });

      await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'test2@example.com',
          username: 'testuser2',
          password: 'password123'
        }
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/users'
      });

      assert.strictEqual(response.statusCode, 200);
      
      const data = JSON.parse(response.payload);
      assert(Array.isArray(data.users));
      assert.strictEqual(data.count, 2);
    });

    test('应该支持查询参数过滤', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/users?email=test1@example.com'
      });

      assert.strictEqual(response.statusCode, 200);
      
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.count, 1);
      assert.strictEqual(data.users[0].email, 'test1@example.com');
    });
  });

  describe('GET /users/:id', () => {
    test('应该返回指定用户', async () => {
      // 创建用户
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'specific@example.com',
          username: 'specificuser',
          password: 'password123'
        }
      });

      const user = JSON.parse(createResponse.payload).user;

      // 获取用户详情
      const response = await fastify.inject({
        method: 'GET',
        url: `/users/${user.id}`
      });

      assert.strictEqual(response.statusCode, 200);
      
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.user.id, user.id);
      assert.strictEqual(data.user.email, 'specific@example.com');
    });

    test('应该返回404当用户不存在', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/users/999'
      });

      assert.strictEqual(response.statusCode, 404);
      
      const data = JSON.parse(response.payload);
      assert.strictEqual(data.error, 'Not Found');
    });
  });
});
```

### 数据库集成测试

#### Repository 集成测试
```typescript
// test/integration/repository/userRepository.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { UserRepository } from '../../../src/repository/userRepository.js';
import { cleanDatabase } from '../helpers/database.js';

describe('UserRepository Integration', () => {
  let userRepository: UserRepository;
  let knex: any;
  let redis: any;

  before(async () => {
    // 初始化测试数据库连接
    knex = require('knex')({
      client: 'mysql2',
      connection: {
        host: 'localhost',
        user: 'test_user',
        password: 'test_password',
        database: 'yishan_test'
      }
    });

    redis = require('redis').createClient({
      url: 'redis://localhost:6379'
    });

    userRepository = new UserRepository({ knex, redis });
  });

  after(async () => {
    await cleanDatabase();
    await knex.destroy();
    await redis.quit();
  });

  test('应该正确创建和查询用户', async () => {
    const userData = {
      email: 'integration@test.com',
      username: 'integrationuser',
      password: 'hashed_password'
    };

    // 创建用户
    const createdUser = await userRepository.create(userData);
    assert.strictEqual(createdUser.email, userData.email);

    // 通过邮箱查询
    const foundUser = await userRepository.findByEmail(userData.email);
    assert.strictEqual(foundUser?.email, userData.email);

    // 通过ID查询
    const userById = await userRepository.findById(createdUser.id);
    assert.strictEqual(userById?.id, createdUser.id);
  });

  test('应该正确处理缓存', async () => {
    const userData = {
      email: 'cache@test.com',
      username: 'cacheuser',
      password: 'hashed_password'
    };

    // 创建用户
    const user = await userRepository.create(userData);
    
    // 第一次查询 - 应该缓存
    const firstQuery = await userRepository.findById(user.id);
    assert.strictEqual(firstQuery?.id, user.id);

    // 更新用户
    await userRepository.update(user.id, { username: 'updateduser' });

    // 再次查询 - 应该获取更新后的数据
    const updatedUser = await userRepository.findById(user.id);
    assert.strictEqual(updatedUser?.username, 'updateduser');
  });
});
```

## 端到端测试

### 完整业务流程测试
```typescript
// test/e2e/user-workflow.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { cleanDatabase } from '../helpers/database.js';

describe('User Management E2E', () => {
  let fastify: any;

  before(async () => {
    // 启动完整的应用
    fastify = Fastify();
    await fastify.register(require('../../../src/app.js'));
    await fastify.ready();
  });

  after(async () => {
    await cleanDatabase();
    await fastify.close();
  });

  test('应该完成完整的用户生命周期', async () => {
    // 1. 创建用户
    const createResponse = await fastify.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        email: 'lifecycle@example.com',
        username: 'lifecycleuser',
        password: 'SecurePass123!'
      }
    });

    assert.strictEqual(createResponse.statusCode, 201);
    const user = JSON.parse(createResponse.payload).user;

    // 2. 获取用户列表
    const listResponse = await fastify.inject({
      method: 'GET',
      url: '/api/v1/users'
    });

    assert.strictEqual(listResponse.statusCode, 200);
    const listData = JSON.parse(listResponse.payload);
    assert.strictEqual(listData.count, 1);

    // 3. 更新用户信息
    const updateResponse = await fastify.inject({
      method: 'PUT',
      url: `/api/v1/users/${user.id}`,
      payload: {
        username: 'updatedlifecycle'
      }
    });

    assert.strictEqual(updateResponse.statusCode, 200);

    // 4. 验证更新
    const getResponse = await fastify.inject({
      method: 'GET',
      url: `/api/v1/users/${user.id}`
    });

    assert.strictEqual(getResponse.statusCode, 200);
    const updatedUser = JSON.parse(getResponse.payload).user;
    assert.strictEqual(updatedUser.username, 'updatedlifecycle');

    // 5. 删除用户
    const deleteResponse = await fastify.inject({
      method: 'DELETE',
      url: `/api/v1/users/${user.id}`
    });

    assert.strictEqual(deleteResponse.statusCode, 200);

    // 6. 验证删除
    const deletedResponse = await fastify.inject({
      method: 'GET',
      url: `/api/v1/users/${user.id}`
    });

    assert.strictEqual(deletedResponse.statusCode, 404);
  });
});
```

## 测试工具和技术

### Mock 和 Stub

#### 使用 Sinon.js
```typescript
import sinon from 'sinon';

describe('with sinon mocks', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('应该使用 sinon stub', async () => {
    const stub = sandbox.stub(userRepository, 'findByEmail');
    stub.resolves({ id: 1, email: 'test@test.com' });

    const result = await userService.createUser(userData);
    
    assert(stub.calledOnce);
    assert.strictEqual(result.email, 'test@test.com');
  });
});
```

### 测试数据工厂

#### 使用 Factory 模式
```typescript
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export class UserFactory {
  static create(overrides = {}) {
    return {
      email: faker.internet.email(),
      username: faker.internet.userName(),
      password: 'hashed_password',
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      ...overrides
    };
  }

  static async createInDatabase(knex: any, overrides = {}) {
    const userData = this.create(overrides);
    const [id] = await knex('users').insert(userData);
    return { id, ...userData };
  }
}

// 使用示例
const testUser = await UserFactory.createInDatabase(knex, {
  email: 'specific@test.com'
});
```

## 测试配置

### 环境配置
```javascript
// test/config/setup.js
import { before, after } from 'node:test';

before(async () => {
  // 全局测试设置
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/yishan_test';
  
  // 初始化测试数据库
  await setupTestDatabase();
});

after(async () => {
  // 全局测试清理
  await cleanupTestDatabase();
});
```

### 测试运行配置
```json
// package.json
{
  "scripts": {
    "test": "node --test --require test/config/setup.js",
    "test:unit": "node --test test/unit/**/*.test.ts",
    "test:integration": "node --test test/integration/**/*.test.ts",
    "test:e2e": "node --test test/e2e/**/*.test.ts",
    "test:coverage": "c8 node --test",
    "test:watch": "node --test --watch"
  }
}
```

## 性能测试

### 负载测试
```typescript
// test/performance/load.test.ts
import autocannon from 'autocannon';

test('应该处理高并发请求', async () => {
  const result = await autocannon({
    url: 'http://localhost:3000/api/v1/users',
    connections: 10,
    duration: 10,
    requests: [
      {
        method: 'GET',
        path: '/api/v1/users'
      }
    ]
  });

  assert(result.errors === 0);
  assert(result.requests.average > 100); // 每秒至少100个请求
});
```

## 测试报告

### 覆盖率报告
```bash
# 生成覆盖率报告
npm run test:coverage

# 查看HTML报告
open coverage/index.html
```

### 测试结果格式
```json
{
  "summary": {
    "totalTests": 150,
    "passed": 145,
    "failed": 3,
    "skipped": 2,
    "duration": "2.5s"
  },
  "coverage": {
    "lines": 82,
    "functions": 78,
    "branches": 75,
    "statements": 80
  }
}
```

## 持续集成

### GitHub Actions 配置
```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: yishan_test
        ports:
          - 3306:3306
      
      redis:
        image: redis:6.0
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:coverage
      env:
        TEST_DB_HOST: localhost
        TEST_DB_USER: root
        TEST_DB_PASSWORD: root
        TEST_DB_NAME: yishan_test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## 测试最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 遵循 "should...when..." 模式
- 避免技术术语

### 2. 测试结构
- 使用 describe 分组
- 每个测试只验证一个行为
- 保持测试独立

### 3. 测试数据
- 使用工厂模式创建测试数据
- 避免硬编码值
- 清理测试数据

### 4. Mock 策略
- 只 mock 外部依赖
- 使用接口而不是实现
- 验证交互

### 5. 错误处理
- 测试错误场景
- 验证错误消息
- 测试边界条件

## 调试技巧

### 调试测试
```bash
# 使用 Node.js 调试器
node --inspect-brk --test test/unit/services/userService.test.ts

# 使用 VS Code 调试配置
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/node",
  "args": ["--test", "${relativeFile}"],
  "console": "integratedTerminal"
}
```

### 日志调试
```typescript
// 在测试中启用详细日志
import { setGlobalDispatcher } from 'undici';

before(() => {
  // 设置测试日志级别
  process.env.LOG_LEVEL = 'debug';
});
```

---

*最后更新: 2024年*
*测试框架: Node.js 内置测试框架 + c8*