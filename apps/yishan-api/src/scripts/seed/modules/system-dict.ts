import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { DictSeedConfig } from '../config.js';

export async function seedDicts(prisma: PrismaClient, adminUserId: number, dicts: DictSeedConfig[]) {
  for (const dict of dicts) {
    const dictType = await prisma.sysDictType.upsert({
      where: { type: dict.type.type },
      update: {
        name: dict.type.name,
        status: 1,
        sort_order: dict.type.sortOrder,
        remark: dict.type.remark,
        updaterId: adminUserId,
      },
      create: {
        name: dict.type.name,
        type: dict.type.type,
        status: 1,
        sort_order: dict.type.sortOrder,
        remark: dict.type.remark,
        creatorId: adminUserId,
        updaterId: adminUserId,
      },
    });

    for (const data of dict.data) {
      await prisma.sysDictData.upsert({
        where: { typeId_value: { typeId: dictType.id, value: data.value } },
        update: {
          label: data.label,
          status: 1,
          sort_order: data.sortOrder,
          remark: data.remark,
          isDefault: data.isDefault ?? false,
          updaterId: adminUserId,
        },
        create: {
          typeId: dictType.id,
          label: data.label,
          value: data.value,
          status: 1,
          sort_order: data.sortOrder,
          remark: data.remark,
          isDefault: data.isDefault ?? false,
          creatorId: adminUserId,
          updaterId: adminUserId,
        },
      });
    }
  }

  console.log('系统字典数据创建完成');
}

