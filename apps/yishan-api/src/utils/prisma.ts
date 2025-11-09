import { PrismaClient } from '../generated/prisma/client.js';

/**
 * 官方文档的简单示例确实很容易理解，但在生产环境中我们需要考虑更多问题：
 * 
 * 1. 连接池管理 - 避免创建多个PrismaClient实例
 * 2. 错误处理 - 统一的错误处理和日志记录
 * 3. 连接状态管理 - 确保连接正常
 * 4. 优雅关闭 - 应用关闭时正确断开连接
 * 5. 性能监控 - 查询性能统计
 * 6. 事务管理 - 复杂业务逻辑的事务支持
 */

// 扩展PrismaClient以添加自定义功能
class ExtendedPrismaClient extends PrismaClient {
  private queryCount = 0;
  private startTime = Date.now();

  constructor() {
    const enableQueryEvent = process.env.NODE_ENV !== 'production';
    super({
      log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
        // 在开发环境开启查询事件以便性能监控
        ...(enableQueryEvent ? ([{ emit: 'event', level: 'query' }] as any) : []),
      ],
    });

    // 监听查询事件以进行性能监控（仅在事件模式开启时有效）
    try {
      (this as any).$on('query', (e: any) => {
        this.queryCount++;
        console.log(`[Prisma] Query #${this.queryCount}: ${e.query} (${e.duration}ms)`);
      });
    } catch (error) {
      // 如果查询事件监听失败，不影响主要功能
      console.warn('Failed to setup query monitoring:', error);
    }
  }

  getStats() {
    return {
      queryCount: this.queryCount,
      uptime: Date.now() - this.startTime,
    };
  }
}

// 单例模式管理PrismaClient实例
class PrismaManager {
  private static instance: PrismaManager;
  private prisma: ExtendedPrismaClient;
  private isConnected = false;

  private constructor() {
    this.prisma = new ExtendedPrismaClient();
  }

  static getInstance(): PrismaManager {
    if (!PrismaManager.instance) {
      PrismaManager.instance = new PrismaManager();
    }
    return PrismaManager.instance;
  }

  // 连接数据库，支持重试机制
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('Database connected successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Database disconnection failed:', error);
      throw error;
    }
  }

  // 获取PrismaClient实例
  getClient(): ExtendedPrismaClient {
    if (!this.isConnected) {
      // console.warn('Database may not be connected. Call connect() first.');
    }
    return this.prisma;
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // 获取连接状态
  getConnectionStatus(): { connected: boolean; stats: any } {
    return {
      connected: this.isConnected,
      stats: this.prisma.getStats(),
    };
  }

  // 事务包装器
  async transaction<T>(fn: (prisma: ExtendedPrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return fn(tx as ExtendedPrismaClient);
    });
  }
}

// 导出一个实例，保持向后兼容
export const prismaManager = PrismaManager.getInstance();

// 快捷导出
export const prisma = prismaManager.getClient();

// 默认导出
export default prismaManager;