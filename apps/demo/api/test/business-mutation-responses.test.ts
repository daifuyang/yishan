import Fastify, { type FastifyPluginAsync } from 'fastify'
import { describe, expect, it, vi } from './runtime-fixture'
import { drizzleDb } from './mocks/drizzle'
import portalCategories from '../src/modules/portal/routes/v1/categories'
import articles from '../src/modules/portal/routes/v1/articles'
import pages from '../src/modules/portal/routes/v1/pages'
import articleTemplates from '../src/modules/portal/routes/v1/article-templates'
import pageTemplates from '../src/modules/portal/routes/v1/page-templates'
import shopCategories from '../src/modules/shop/routes/v1/categories'
import products from '../src/modules/shop/routes/v1/products'
import attributes from '../src/modules/shop/routes/v1/attributes'
import orders from '../src/modules/shop/routes/v1/orders'
import { CategoriesService as PortalCategories } from '../src/modules/portal/services/categories.service'
import { ArticlesService } from '../src/modules/portal/services/articles.service'
import { PagesService } from '../src/modules/portal/services/pages.service'
import { TemplatesService } from '../src/modules/portal/services/templates.service'
import { CategoriesService as ShopCategories } from '../src/modules/shop/services/categories.service'
import { ProductsService } from '../src/modules/shop/services/products.service'
import { AttributesService } from '../src/modules/shop/services/attributes.service'
import { OrdersService } from '../src/modules/shop/services/orders.service'

const base = { id: 1, createdAt: new Date('2026-10-09T00:00:00Z'), updatedAt: new Date('2026-10-09T00:00:00Z'), status: 1, creatorId: 1, updaterId: 1 }
const category = { ...base, name: '分类', slug: null, parentId: null, description: null, coverImage: null, icon: null, sortOrder: 0 }
const article = { ...base, title: '文章', slug: null, summary: null, content: '正文', coverImage: null, isPinned: false, publishTime: null, templateId: null }
const page = { ...base, title: '页面', path: '/test', content: '正文', publishTime: null, templateId: null }
const template = { ...base, name: '模板', description: null, type: 0, isSystemDefault: false }
const product = { ...base, categoryId: 1, name: '商品', subtitle: null, coverImage: null, description: null, price: '10.00', costPrice: null, stock: 1, unit: '件', weight: null, isHot: false, isNew: false, sortOrder: 0, clickCount: 0 }
const sku = { ...base, productId: 1, skuCode: 'SKU-1', skuName: '规格', price: '10.00', costPrice: null, stock: 1, weight: null, coverImage: null }
const attribute = { ...base, name: '属性', type: 1, sortOrder: 0 }
const value = { ...base, attributeId: 1, value: '红色', image: null, sortOrder: 0 }
const order = { ...base, orderNo: 'ORDER-1', userId: 1, totalAmount: '10.00', freightAmount: '0.00', discountAmount: '0.00', payAmount: '10.00', payStatus: 0, payTime: null, payMethod: null, orderStatus: 0, expressCompany: null, expressNo: null, deliverTime: null, receiveTime: null, cancelReason: null, remark: null }

async function appFor(plugin: FastifyPluginAsync) {
  const app = Fastify()
  app.decorate('drizzleDb', drizzleDb)
  // Authentication is covered by product integration; these tests exercise real response serializers.
  app.decorate('authenticate', async () => {})
  app.decorate('requirePermission', () => async () => {})
  await app.register(plugin)
  return app
}

const resources = [
  { name: 'portal categories', plugin: portalCategories, service: PortalCategories, row: category, payload: { name: '分类' } },
  { name: 'portal articles', plugin: articles, service: ArticlesService, row: article, payload: { title: '文章', content: '正文' } },
  { name: 'portal pages', plugin: pages, service: PagesService, row: page, payload: { title: '页面', path: '/test', content: '正文' } },
  { name: 'article templates', plugin: articleTemplates, service: TemplatesService, row: template, payload: { name: '模板', type: 0 } },
  { name: 'page templates', plugin: pageTemplates, service: TemplatesService, row: { ...template, type: 1 }, payload: { name: '模板', type: 1 } },
  { name: 'shop categories', plugin: shopCategories, service: ShopCategories, row: category, payload: { name: '分类' } },
  { name: 'shop products', plugin: products, service: ProductsService, row: product, payload: { name: '商品', categoryId: 1, price: '10.00' } },
  { name: 'shop attributes', plugin: attributes, service: AttributesService, row: attribute, payload: { name: '属性' } },
  { name: 'shop orders', plugin: orders, service: OrdersService, row: order, payload: { orderNo: 'ORDER-1', userId: 1, totalAmount: '10.00', payAmount: '10.00', items: [{ productId: 1, productName: '商品', price: '10.00', quantity: 1, subtotal: '10.00' }] } },
]

describe('business mutation HTTP contracts', () => {
  for (const resource of resources) {
    for (const method of ['POST', 'PATCH'] as const) {
      it(`${method} ${resource.name} returns the documented entity without an envelope`, async () => {
        vi.spyOn(resource.service.prototype, method === 'POST' ? 'create' : 'update').mockResolvedValue(resource.row as never)
        const app = await appFor(resource.plugin)
        try {
          const response = await app.inject({ method, url: method === 'POST' ? '/' : '/1', payload: method === 'POST' ? resource.payload : {} })
          expect(response.statusCode, response.body).toBe(200)
          expect(response.json()).toMatchObject({ id: resource.row.id, createdAt: base.createdAt.toISOString() })
          expect(response.json()).not.toHaveProperty('data')
        } finally { await app.close() }
      })
    }
  }
  for (const method of ['POST', 'PATCH'] as const) {
    it(`${method} SKU returns the documented entity`, async () => {
      vi.spyOn(ProductsService.prototype, method === 'POST' ? 'createSku' : 'updateSku').mockResolvedValue(sku as never)
      const app = await appFor(products)
      try {
        const response = await app.inject({ method, url: method === 'POST' ? '/1/skus' : '/skus/1', payload: method === 'POST' ? { skuCode: sku.skuCode, skuName: sku.skuName, price: sku.price } : {} })
        expect(response.statusCode, response.body).toBe(200)
        expect(response.json()).toMatchObject({ id: 1, skuCode: sku.skuCode })
      } finally { await app.close() }
    })
  }
  it('POST attribute value returns the documented entity', async () => {
    vi.spyOn(AttributesService.prototype, 'createValue').mockResolvedValue(value as never)
    const app = await appFor(attributes)
    try {
      const response = await app.inject({ method: 'POST', url: '/1/values', payload: { value: value.value } })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ id: 1, value: value.value })
    } finally { await app.close() }
  })
})
