import { PrismaClient } from '../generated/prisma/client.js';

class DatabaseClient {
  private static instance: DatabaseClient;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  public async connect(): Promise<void> {
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

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Database disconnection failed:', error);
      throw error;
    }
  }

  public getPrisma(): PrismaClient {
    if (!this.isConnected) {
      console.warn('Database may not be connected. Call connect() first.');
    }
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const db = DatabaseClient.getInstance();
export default db;