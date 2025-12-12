import { prismaManager } from "../utils/prisma.js";

export class SysOptionModel {
  private static prisma = prismaManager.getClient();

  static async getOptionValue(key: string): Promise<number | null> {
    const opt = await this.prisma.sysOption.findFirst({ where: { key, deletedAt: null } });
    return opt?.value ?? null;
  }

  static async setOptionValue(key: string, value: number, userId?: number): Promise<number> {
    const existed = await this.prisma.sysOption.findFirst({ where: { key, deletedAt: null } });
    if (existed) {
      await this.prisma.sysOption.update({ where: { id: existed.id }, data: { value, updaterId: userId } });
      return value;
    }
    await this.prisma.sysOption.create({ data: { key, value, status: 1, creatorId: userId, updaterId: userId } });
    return value;
  }
}

