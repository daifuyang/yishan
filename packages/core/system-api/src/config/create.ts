import { createAdminConfig } from './admin'
import { createStorageConfig } from './storage'
import type { ConnectionOptions } from 'node:tls'

export function createSystemConfig(env: Record<string, string | undefined>, root: string) {
/**
 * 应用配置中心
 * 统一管理所有环境变量和配置项
 */

// JWT 配置
const JWT_CONFIG = {
  // JWT 密钥
  secret: env.JWT_SECRET || 'your-secret-key-change-this-in-production',

  // 默认过期时间（用于兼容现有代码）
  expiresIn: env.JWT_EXPIRES_IN || '24h',

  // 访问令牌配置
  accessToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(env.JWT_ACCESS_TOKEN_EXPIRES_IN || '86400'), // 24小时

    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(env.JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN || '2592000'), // 30天
  },

  // 刷新令牌配置
  refreshToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(env.JWT_REFRESH_TOKEN_EXPIRES_IN || '604800'), // 7天

    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(env.JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN || '7776000'), // 90天
  }
};

// Redis 配置
let REDIS_CONFIG: {
  host: string; port: number; password: string; db: number; username: string | undefined; tls?: ConnectionOptions
} = {
  host: env.REDIS_HOST || 'localhost',
  port: parseInt(env.REDIS_PORT || '6379'),
  password: env.REDIS_PASSWORD || '',
  db: parseInt(env.REDIS_DB || '0'),
  username: env.REDIS_USERNAME,
};
if (env.REDIS_URL) {
  const url = new URL(env.REDIS_URL);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') throw new Error('REDIS_URL must use redis:// or rediss://');
  REDIS_CONFIG = {
    host: url.hostname,
    port: Number(url.port || '6379'),
    password: decodeURIComponent(url.password),
    username: url.username ? decodeURIComponent(url.username) : env.REDIS_USERNAME,
    db: Number(url.pathname.slice(1) || '0'),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

// 应用配置
const APP_CONFIG = {
  nodeEnv: env.NODE_ENV || 'development',
  port: parseInt(env.PORT || '3000'),
  logLevel: env.LOG_LEVEL || 'info',
};

// 安全配置
const SECURITY_CONFIG = {
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
    maxFailedAttempts: parseInt(env.MAX_LOGIN_FAILED_ATTEMPTS || '5'),

    // 账号锁定时间（秒）
    lockoutDuration: parseInt(env.LOGIN_LOCKOUT_DURATION || '3600'), // 1小时
  }
};

// 缓存配置（统一TTL管理）
const CACHE_CONFIG = {
  // 全局默认TTL（秒） 一天
  defaultTTLSeconds: parseInt(env.CACHE_TTL_DEFAULT || '86400'),
};

// 存储与上传配置见 `./storage.ts`：结构化对象，含 diskRoot / urlPrefix / isPublic


// Admin 部署配置见 `./admin.ts`：结构化对象，含 mount.mode / diskPath / redirectRoot


// 七牛云配置
const QINIU_CONFIG = {
  accessKey: env.QINIU_AK || '',
  secretKey: env.QINIU_SK || '',
  bucket: env.QINIU_BUCKET || '',
  /** 过期时间（秒），默认1小时 */
  expiresIn: parseInt(env.QINIU_EXPIRES || '3600'),
  /** 可选：直传上传域名，如 https://upload.qiniup.com */
  uploadUrl: env.QINIU_UPLOAD_URL || '',
};

return {
  JWT_CONFIG, REDIS_CONFIG, APP_CONFIG, SECURITY_CONFIG, CACHE_CONFIG, QINIU_CONFIG,
  ADMIN: createAdminConfig(env, root),
  STORAGE: createStorageConfig(env, root),
  cronToken: env.CRON_TOKEN,
  allowWeakJwt: env.JWT_ALLOW_WEAK_SECRET === '1',
  cacheNamespace: env.CACHE_NAMESPACE || root,
  commitSha: env.GIT_COMMIT_SHA || 'unknown',
  version: env.npm_package_version || '0.0.0',
  rateLimits: {
    login: Number(env.LOGIN_RATELIMIT_PER_MIN) || 5,
    refresh: Number(env.REFRESH_RATELIMIT_PER_MIN) || 30,
    patCreate: Number(env.PAT_CREATE_RATELIMIT_PER_MIN) || 10,
  },
  seed: {
    adminPassword: env.SEED_ADMIN_PASSWORD || (env.NODE_ENV === 'production' ? '' : 'admin123'),
    allowProduction: env.ALLOW_PRODUCTION_SEED === 'true',
  },
}
}
export type SystemConfig = ReturnType<typeof createSystemConfig>
