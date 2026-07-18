import { eq, sql } from 'drizzle-orm';
import { iximeiCrmHospital, iximeiCrmCustomer, iximeiCrmDispatch, iximeiCrmDispatchStatus, iximeiCrmMemberCustomer } from '@/db/schema';
import type { SeedDb } from '../context';

export async function seedCrm(db: SeedDb, adminId: number) {
  const now = new Date();

  // 客户状态由 CRM 迁移 0002_customer_statuses.sql 统一维护，seed 不重复写入。

  await db.insert(iximeiCrmDispatchStatus).values([
    { id: 1, name: '待回复', sortOrder: 1, status: 1, createdAt: now, updatedAt: now },
    { id: 2, name: '已联系', sortOrder: 2, status: 1, createdAt: now, updatedAt: now },
    { id: 3, name: '已到院', sortOrder: 3, status: 1, createdAt: now, updatedAt: now },
    { id: 4, name: '已成交', sortOrder: 4, status: 1, createdAt: now, updatedAt: now },
    { id: 5, name: '未成交', sortOrder: 5, status: 1, createdAt: now, updatedAt: now },
    { id: 6, name: '重单', sortOrder: 6, status: 1, createdAt: now, updatedAt: now },
  ]).onDuplicateKeyUpdate({ set: { name: sql`${iximeiCrmDispatchStatus.name}` } });

  await db.insert(iximeiCrmHospital).values({
    hospitalName: '上海华美医疗美容医院',
    provinceId: 310000,
    cityId: 310100,
    districtId: 310105,
    hospitalAddress: '上海市长宁区延安西路758号',
    hospitalPhone: '021-62185555',
    hospitalSelling: '双眼皮、隆鼻、隆胸、注射美容',
    hospitalNature: 1,
    doctorName: '王建国',
    doctorPhone: '13800001111',
    doctorQq: '4008009999',
    receptionName: '李婷',
    receptionPhone: '13800002222',
    receptionQq: '20009988',
    busStation: '延安西路凯旋路',
    busAddress: '乘坐57路、71路、76路公交车',
    subwayStation: '江苏路站',
    subwayAddress: '地铁2号线江苏路站4号口',
    taxiFare: '约25元',
    vipDiscount: '会员享受8折优惠',
    returnPoint: '整形项目返点3%-5%',
    hospitalIntroduction: '上海华美医疗美容医院是经上海市卫生部门批准设立的专业医疗美容机构，拥有国际化医疗团队和先进的医疗设备。',
    status: 1,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(iximeiCrmHospital).values({
    hospitalName: '北京艺星医疗美容医院',
    provinceId: 110000,
    cityId: 110100,
    districtId: 110101,
    hospitalAddress: '北京市东城区东单北大街甲1号',
    hospitalPhone: '010-65296555',
    hospitalSelling: '眼部整形、鼻部整形、面部轮廓',
    hospitalNature: 1,
    doctorName: '张伟明',
    doctorPhone: '13900001111',
    doctorQq: '30009988',
    receptionName: '赵丽',
    receptionPhone: '13900002222',
    receptionQq: '40009988',
    busStation: '东单路口北',
    busAddress: '乘坐1路、52路、108路公交车',
    subwayStation: '东单站',
    subwayAddress: '地铁1号线东单站F口',
    taxiFare: '约30元',
    vipDiscount: '会员享受8.5折优惠',
    returnPoint: '整形项目返点2%-4%',
    hospitalIntroduction: '北京艺星医疗美容医院是一家专业从事医疗美容的连锁机构，汇聚了国内外知名整形专家。',
    status: 1,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(iximeiCrmHospital).values({
    hospitalName: '广州美莱医疗美容医院',
    provinceId: 440100,
    cityId: 440100,
    districtId: 440103,
    hospitalAddress: '广州市越秀区环市东路368号',
    hospitalPhone: '020-83576155',
    hospitalSelling: '激光美容、注射美容、皮肤管理',
    hospitalNature: 1,
    doctorName: '陈晓明',
    doctorPhone: '13700001111',
    doctorQq: '50009988',
    receptionName: '周芳',
    receptionPhone: '13700002222',
    receptionQq: '60009988',
    busStation: '花园酒店',
    busAddress: '乘坐189路、233路公交车',
    subwayStation: '淘金站',
    subwayAddress: '地铁5号线淘金站B口',
    taxiFare: '约20元',
    vipDiscount: '会员享受7.5折优惠',
    returnPoint: '皮肤项目返点4%-6%',
    hospitalIntroduction: '广州美莱医疗美容医院是华南地区知名的医疗美容机构，拥有多间国际标准手术室。',
    status: 1,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: now,
    updatedAt: now,
  });

  const hospital1 = await db.query.iximeiCrmHospital.findFirst({ where: eq(iximeiCrmHospital.hospitalName, '上海华美医疗美容医院') });
  const hospital2 = await db.query.iximeiCrmHospital.findFirst({ where: eq(iximeiCrmHospital.hospitalName, '北京艺星医疗美容医院') });
  const hospital3 = await db.query.iximeiCrmHospital.findFirst({ where: eq(iximeiCrmHospital.hospitalName, '广州美莱医疗美容医院') });

  if (!hospital1 || !hospital2 || !hospital3) {
    console.log('医院数据创建失败，跳过客户数据创建');
    return;
  }

  await db.insert(iximeiCrmCustomer).values({
    numberId: 'VIP000000000001',
    name: '李晓梅',
    gender: 2,
    birthday: new Date('1995-03-15'),
    mobile: '13612340001',
    qq: '1234567890',
    wechat: 'lixiaomei2024',
    provinceId: 310000,
    cityId: 310100,
    districtId: 310105,
    address: '上海市长宁区仙霞路88号',
    plastic: '双眼皮、玻尿酸填充',
    statusId: 2,
    remark: '咨询双眼皮手术，希望近期手术',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(iximeiCrmCustomer).values({
    numberId: 'VIP000000000002',
    name: '王芳',
    gender: 2,
    birthday: new Date('1990-08-20'),
    mobile: '13612340002',
    qq: '2345678901',
    wechat: 'wangfang2024',
    provinceId: 110000,
    cityId: 110100,
    districtId: 110101,
    address: '北京市东城区朝内大街75号',
    plastic: '鼻综合整形',
    statusId: 2,
    remark: '想做自然款鼻综合',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 86400000),
    updatedAt: now,
  });

  await db.insert(iximeiCrmCustomer).values({
    numberId: 'VIP000000000003',
    name: '张丽',
    gender: 2,
    birthday: new Date('1998-12-05'),
    mobile: '13612340003',
    qq: '3456789012',
    wechat: 'zhangli2024',
    provinceId: 440100,
    cityId: 440100,
    districtId: 440103,
    address: '广州市越秀区东风东路653号',
    plastic: '玻尿酸注射下巴',
    statusId: 1,
    remark: '初次咨询，想了解玻尿酸丰下巴',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 172800000),
    updatedAt: now,
  });

  await db.insert(iximeiCrmCustomer).values({
    numberId: 'VIP000000000004',
    name: '刘洋',
    gender: 1,
    birthday: new Date('1988-05-10'),
    mobile: '13612340004',
    qq: '4567890123',
    wechat: 'liuyang2024',
    provinceId: 310000,
    cityId: 310100,
    districtId: 310110,
    address: '上海市浦东新区世纪大道100号',
    plastic: '假体隆胸',
    statusId: 2,
    remark: '已到院面诊，在考虑手术方案',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 259200000),
    updatedAt: now,
  });

  await db.insert(iximeiCrmCustomer).values({
    numberId: 'VIP000000000005',
    name: '陈思思',
    gender: 2,
    birthday: new Date('1993-09-25'),
    mobile: '13612340005',
    qq: '5678901234',
    wechat: 'chensisi2024',
    provinceId: 440100,
    cityId: 440100,
    districtId: 440106,
    address: '广州市天河区天河路385号',
    plastic: '热玛吉抗衰',
    statusId: 4,
    remark: '已完成热玛吉治疗，对效果满意',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 345600000),
    updatedAt: now,
  });

  const customer1 = await db.query.iximeiCrmCustomer.findFirst({ where: eq(iximeiCrmCustomer.numberId, 'VIP000000000001') });
  const customer2 = await db.query.iximeiCrmCustomer.findFirst({ where: eq(iximeiCrmCustomer.numberId, 'VIP000000000002') });
  const customer4 = await db.query.iximeiCrmCustomer.findFirst({ where: eq(iximeiCrmCustomer.numberId, 'VIP000000000004') });
  const customer5 = await db.query.iximeiCrmCustomer.findFirst({ where: eq(iximeiCrmCustomer.numberId, 'VIP000000000005') });

  if (customer1) {
    await db.insert(iximeiCrmDispatch).values({
      customerId: customer1.id,
      hospitalId: hospital1.id,
      statusId: 3,
      receiveQq: '4008009999',
      receiveWechat: 'huamei_shanghai',
      finishedAt: now,
      creatorId: adminId,
      updaterId: adminId,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (customer2) {
    await db.insert(iximeiCrmDispatch).values({
      customerId: customer2.id,
      hospitalId: hospital2.id,
      statusId: 2,
      receiveQq: '30009988',
      receiveWechat: 'yixing_beijing',
      finishedAt: now,
      creatorId: adminId,
      updaterId: adminId,
      createdAt: new Date(now.getTime() - 86400000),
      updatedAt: now,
    });
  }

  if (customer4) {
    await db.insert(iximeiCrmDispatch).values({
      customerId: customer4.id,
      hospitalId: hospital1.id,
      statusId: 2,
      receiveQq: '4008009999',
      receiveWechat: 'huamei_shanghai',
      finishedAt: now,
      creatorId: adminId,
      updaterId: adminId,
      createdAt: new Date(now.getTime() - 172800000),
      updatedAt: now,
    });
  }

  if (customer5) {
    await db.insert(iximeiCrmDispatch).values({
      customerId: customer5.id,
      hospitalId: hospital3.id,
      statusId: 4,
      receiveQq: '50009988',
      receiveWechat: 'meilai_guangzhou',
      finishedAt: now,
      creatorId: adminId,
      updaterId: adminId,
      createdAt: new Date(now.getTime() - 259200000),
      updatedAt: now,
    });
  }

  await db.insert(iximeiCrmMemberCustomer).values({
    numberId: 'VIP000000000011',
    name: '赵敏',
    gender: 2,
    birthday: new Date('1992-07-18'),
    mobile: '13712340001',
    address: '上海市静安区南京西路1266号',
    project: '年度会员：全年不限次数皮肤护理',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(iximeiCrmMemberCustomer).values({
    numberId: 'VIP000000000012',
    name: '孙婷',
    gender: 2,
    birthday: new Date('1996-11-30'),
    mobile: '13712340002',
    address: '北京市朝阳区建国门外大街1号',
    project: '双眼皮手术+术后护理套餐',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 86400000),
    updatedAt: now,
  });

  await db.insert(iximeiCrmMemberCustomer).values({
    numberId: 'VIP000000000013',
    name: '周杰',
    gender: 1,
    birthday: new Date('1985-04-22'),
    mobile: '13712340003',
    address: '广州市天河区珠江新城花城大道88号',
    project: '鼻综合整形+玻尿酸填充',
    ownerUserId: adminId,
    creatorId: adminId,
    updaterId: adminId,
    createdAt: new Date(now.getTime() - 172800000),
    updatedAt: now,
  });

  console.log('CRM示例数据创建完成');
}
