import { Type } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

export const ProductRespSchema = Type.Object({
  id: Type.Number(),
  categoryId: Type.Number(),
  name: Type.String(),
  subtitle: Type.Union([Type.String(), Type.Null()]),
  coverImage: Type.Union([Type.String(), Type.Null()]),
  images: Type.Optional(Type.Any()),
  description: Type.Union([Type.String(), Type.Null()]),
  price: Type.String(),
  costPrice: Type.Union([Type.String(), Type.Null()]),
  stock: Type.Number(),
  unit: Type.String(),
  weight: Type.Union([Type.String(), Type.Null()]),
  status: Type.Number(),
  isHot: Type.Boolean(),
  isNew: Type.Boolean(),
  sortOrder: Type.Number(),
  clickCount: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const ProductListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(ProductRespSchema),
})

export const ProductListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    categoryId: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.Integer()),
    isHot: Type.Optional(Type.Boolean()),
    isNew: Type.Optional(Type.Boolean()),
  }),
])

export const ProductCreateReqSchema = Type.Object({
  categoryId: Type.Integer(),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  subtitle: Type.Optional(Type.String({ maxLength: 500 })),
  coverImage: Type.Optional(Type.String({ maxLength: 500 })),
  images: Type.Optional(Type.Any()),
  description: Type.Optional(Type.String()),
  price: Type.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  costPrice: Type.Optional(Type.String({ pattern: '^\\d+(\\.\\d{1,2})?$' })),
  stock: Type.Optional(Type.Integer({ minimum: 0 })),
  unit: Type.Optional(Type.String({ maxLength: 20 })),
  weight: Type.Optional(Type.String()),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  isHot: Type.Optional(Type.Boolean()),
  isNew: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer()),
})
export const ProductUpdateReqSchema = Type.Partial(ProductCreateReqSchema)

export const SkuRespSchema = Type.Object({
  id: Type.Number(),
  productId: Type.Number(),
  skuCode: Type.String(),
  skuName: Type.String(),
  price: Type.String(),
  costPrice: Type.Union([Type.String(), Type.Null()]),
  stock: Type.Number(),
  weight: Type.Union([Type.String(), Type.Null()]),
  coverImage: Type.Union([Type.String(), Type.Null()]),
  status: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const SkuCreateReqSchema = Type.Object({
  skuCode: Type.String({ minLength: 1, maxLength: 64 }),
  skuName: Type.String({ minLength: 1, maxLength: 500 }),
  price: Type.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  costPrice: Type.Optional(Type.String()),
  stock: Type.Optional(Type.Integer({ minimum: 0 })),
  weight: Type.Optional(Type.String()),
  coverImage: Type.Optional(Type.String({ maxLength: 500 })),
  status: Type.Optional(Type.Integer()),
})
export const SkuUpdateReqSchema = Type.Partial(SkuCreateReqSchema)
