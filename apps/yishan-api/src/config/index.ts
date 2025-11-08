/**
 * 应用配置中心
 * 统一管理所有环境变量和配置项
 */

// JWT 配置
export const JWT_CONFIG = {
  // JWT 密钥
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  
  // 默认过期时间（用于兼容现有代码）
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // 访问令牌配置
  accessToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '86400'), // 24小时
    
    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN || '2592000'), // 30天
  },
  
  // 刷新令牌配置
  refreshToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '604800'), // 7天
    
    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN || '7776000'), // 90天
  }
};

// 数据库配置
export const DATABASE_CONFIG = {
  url: process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/fastify_prisma',
};

// Redis 配置
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
};

// 应用配置
export const APP_CONFIG = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

// 安全配置
export const SECURITY_CONFIG = {
  // 密码加密相关配置
  password: {
    // scrypt 算法参数
    scrypt: {
      keylen: 32,
      cost: 16384, // 2^14
      blockSize: 8,
      parallelization: 1,
    }
  },
  
  // 登录安全相关配置
  login: {
    // 最大登录失败次数（用于账号锁定）
    maxFailedAttempts: parseInt(process.env.MAX_LOGIN_FAILED_ATTEMPTS || '5'),
    
    // 账号锁定时间（秒）
    lockoutDuration: parseInt(process.env.LOGIN_LOCKOUT_DURATION || '3600'), // 1小时
  }
};

// 缓存配置（统一TTL管理）
export const CACHE_CONFIG = {
  // 全局默认TTL（秒）
  defaultTTLSeconds: parseInt(process.env.CACHE_TTL_DEFAULT || '300'),
  // 具体场景TTL（可按需扩展），支持向后兼容旧变量
  userDetailTTLSeconds: parseInt(
    process.env.CACHE_TTL_USER_DETAIL
      || process.env.USER_DETAIL_CACHE_TTL
      || (process.env.CACHE_TTL_DEFAULT || '300')
  ),
};