import fp from 'fastify-plugin'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'

/**
 * TypeBox 类型提供者插件
 * 
 * 功能：
 * 1. 为 Fastify 应用注册 TypeBox 类型提供者
 * 2. 提供编译时类型安全和运行时验证
 * 3. 自动生成 JSON Schema 用于 Swagger 文档
 */
export default fp(async (fastify) => {
  // 注册 TypeBox 类型提供者
  fastify.withTypeProvider<TypeBoxTypeProvider>()
  
  fastify.log.info('TypeBox type provider registered successfully')
}, {
  name: 'typebox-provider',
  dependencies: []
})