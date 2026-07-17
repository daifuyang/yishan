import { eq } from 'drizzle-orm';
import { sysDictData, sysDictType } from '@/db/schema';
import type { DictSeedConfig } from '../config.js';
import type { SeedDb } from '../context.js';

export async function seedDicts(db: SeedDb, adminUserId: number, dicts: DictSeedConfig[]) {
  for (const dict of dicts) {
    const dictTypeCreateData = {
      name: dict.type.name,
      type: dict.type.type,
      status: 1,
      sortOrder: dict.type.sortOrder,
      ...(dict.type.remark !== undefined ? { remark: dict.type.remark } : {}),
      creatorId: adminUserId,
      updaterId: adminUserId,
    };
    const dictTypeUpdateData = {
      name: dict.type.name,
      status: 1,
      sortOrder: dict.type.sortOrder,
      ...(dict.type.remark !== undefined ? { remark: dict.type.remark } : {}),
      updaterId: adminUserId,
    };

    await db
      .insert(sysDictType)
      .values(dictTypeCreateData)
      .onDuplicateKeyUpdate({ set: dictTypeUpdateData });

    const dictType = await db.query.sysDictType.findFirst({
      where: eq(sysDictType.type, dict.type.type),
    });
    if (!dictType) {
      throw new Error(`字典类型数据写入后未找到: ${dict.type.type}`);
    }

    for (const data of dict.data) {
      const dictDataCreateData = {
        typeId: dictType.id,
        label: data.label,
        value: data.value,
        status: 1,
        sortOrder: data.sortOrder,
        ...(data.remark !== undefined ? { remark: data.remark } : {}),
        isDefault: data.isDefault ?? false,
        creatorId: adminUserId,
        updaterId: adminUserId,
      };
      const dictDataUpdateData = {
        label: data.label,
        status: 1,
        sortOrder: data.sortOrder,
        ...(data.remark !== undefined ? { remark: data.remark } : {}),
        isDefault: data.isDefault ?? false,
        updaterId: adminUserId,
      };

      await db
        .insert(sysDictData)
        .values(dictDataCreateData)
        .onDuplicateKeyUpdate({ set: dictDataUpdateData });
    }
  }

  console.log('系统字典数据创建完成');
}
