import { Type } from '@sinclair/typebox'

export const CrmHospitalOverviewCategorySchema = Type.Union([
  Type.Literal('oral'),
  Type.Literal('plastic'),
  Type.Literal('unknown'),
])

export const CrmHospitalOverviewSchema = Type.Object(
  {
    generatedAt: Type.String({ format: 'date-time' }),
    filters: Type.Object({
      startDate: Type.Optional(Type.String()),
      endDate: Type.Optional(Type.String()),
      category: Type.Optional(CrmHospitalOverviewCategorySchema),
      provinceCode: Type.Optional(Type.Union([Type.Integer(), Type.Literal('missing')])),
      cityCode: Type.Optional(Type.Union([Type.Integer(), Type.Literal('missing')])),
      hospitalScope: Type.Optional(Type.Literal('period-new')),
      status: Type.Optional(Type.Integer()),
    }),
    summary: Type.Object({
      total: Type.Integer(),
      oral: Type.Integer(),
      plastic: Type.Integer(),
      unknown: Type.Integer(),
      periodNew: Type.Integer(),
    }),
    byCategory: Type.Array(Type.Object({
      category: CrmHospitalOverviewCategorySchema,
      hospitalCount: Type.Integer(),
    })),
    byProvince: Type.Array(Type.Object({
      provinceCode: Type.Union([Type.Integer(), Type.Literal('missing')]),
      provinceName: Type.String(),
      hospitalCount: Type.Integer(),
    })),
    byCity: Type.Array(Type.Object({
      provinceCode: Type.Union([Type.Integer(), Type.Literal('missing')]),
      provinceName: Type.String(),
      cityCode: Type.Union([Type.Integer(), Type.Literal('missing')]),
      cityName: Type.String(),
      hospitalCount: Type.Integer(),
    })),
    businessByCategory: Type.Array(Type.Object({
      category: CrmHospitalOverviewCategorySchema,
      dispatchCount: Type.Integer(),
      arrivedCount: Type.Integer(),
      dealCount: Type.Integer(),
      arrivedRate: Type.Number(),
      dealRate: Type.Number(),
    })),
  },
  { $id: 'crmHospitalOverview' },
)

export const CrmHospitalOverviewDetailSchema = Type.Object(
  {
    id: Type.Integer(),
    hospitalName: Type.String(),
    category: CrmHospitalOverviewCategorySchema,
    provinceName: Type.String(),
    cityName: Type.String(),
    status: Type.Integer({ minimum: 0, maximum: 1 }),
    dispatchCount: Type.Integer(),
    arrivedCount: Type.Integer(),
    dealCount: Type.Integer(),
    latestDispatchAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { $id: 'crmHospitalOverviewDetail' },
)

/** 单个城市的医院分布项。 */
export const CrmHospitalDistributionItemSchema = Type.Object(
  {
    provinceCode: Type.Integer(),
    provinceName: Type.String(),
    cityCode: Type.Integer(),
    cityName: Type.String(),
    oralCount: Type.Integer(),
    plasticCount: Type.Integer(),
    total: Type.Integer(),
  },
  { $id: 'crmHospitalDistributionItem' },
)

/** 医院分布响应：items + 生成时间戳。 */
export const CrmHospitalDistributionRespSchema = Type.Object(
  {
    generatedAt: Type.String({ format: 'date-time' }),
    items: Type.Array(CrmHospitalDistributionItemSchema),
  },
  { $id: 'crmHospitalDistributionResp' },
)

/** 单个医院的效率排行项。 */
export const CrmHospitalRankingsItemSchema = Type.Object(
  {
    hospitalId: Type.Number(),
    hospitalName: Type.String(),
    dispatchCount: Type.Number(),
    viewedCount: Type.Number(),
    unviewedCount: Type.Number(),
    viewedRate: Type.Number(),
    replyCount: Type.Number(),
    firstViewedAt: Type.Union([
      Type.String({ format: 'date-time' }),
      Type.Null(),
    ]),
  },
  { $id: 'crmHospitalRankingsItem' },
)

/** 医院效率榜响应：items + 生成时间戳。 */
export const CrmHospitalRankingsRespSchema = Type.Object(
  {
    items: Type.Array(CrmHospitalRankingsItemSchema),
    generatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'crmHospitalRankingsResp' },
)

export const DashboardStatsSchema = Type.Object(
  {
    generatedAt: Type.Optional(Type.String()),
    hospitals: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      activeCount: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
    }),
    customers: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
      dayNew: Type.Integer(),
    }),
    dispatches: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      periodCompleted: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
      monthCompleted: Type.Integer(),
    }),
    customerByStatus: Type.Array(
      Type.Object({
        name: Type.String(),
        count: Type.Integer(),
      }),
    ),
    dispatchByStatus: Type.Array(
      Type.Object({
        name: Type.String(),
        count: Type.Integer(),
      }),
    ),
    monthlyTrend: Type.Object({
      customers: Type.Array(
        Type.Object({ month: Type.String(), count: Type.Integer() }),
      ),
      dispatches: Type.Array(
        Type.Object({ month: Type.String(), count: Type.Integer() }),
      ),
    }),
    // 医院效率榜（按医院聚合派单/查看/回复指标）。可选保留，便于未来下线时向后兼容。
    hospitalRankings: Type.Optional(CrmHospitalRankingsRespSchema),
    // 医院分布看板（按城市聚合口腔 / 整形医院数）。可选保留，便于未来下线时向后兼容。
    hospitalDistribution: Type.Optional(CrmHospitalDistributionRespSchema),
  },
  { $id: 'crmDashboardStats' },
)
