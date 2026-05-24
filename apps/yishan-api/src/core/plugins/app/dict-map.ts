import fp from 'fastify-plugin'
import { DictService } from '../../services/dict.service.js'

/**
 * 字典映射插件
 * 提供从fastify实例直接获取字典映射数据的功能
 */
export default fp(async (fastify, opts) => {
  // 装饰器：添加获取字典映射的方法
  fastify.decorate('getDictMap', async (): Promise<Record<string, { label: string; value: string }[]>> => {
    try {
      return await DictService.getAllDictDataMap(fastify)
    } catch (error) {
      fastify.log.error(`获取字典映射失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  })

  // 装饰器：添加获取指定字典类型的方法
  fastify.decorate('getDictByType', async (type: string): Promise<{ label: string; value: string }[]> => {
    try {
      const dictMap = await fastify.getDictMap()
      return dictMap[type] || []
    } catch (error) {
      fastify.log.error(`获取字典类型 [${type}] 失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  })

  // 装饰器：添加获取字典标签的方法
  fastify.decorate('getDictLabel', async (type: string, value: string): Promise<string | undefined> => {
    try {
      const dictData = await fastify.getDictByType(type)
      const item = dictData.find(item => item.value === value)
      return item?.label
    } catch (error) {
      fastify.log.error(`获取字典标签 [${type}.${value}] 失败: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  })

  // 装饰器：添加获取字典值的方法
  fastify.decorate('getDictValue', async (type: string, label: string): Promise<string | undefined> => {
    try {
      const dictData = await fastify.getDictByType(type)
      const item = dictData.find(item => item.label === label)
      return item?.value
    } catch (error) {
      fastify.log.error(`获取字典值 [${type}.${label}] 失败: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  })

  // 装饰器：添加清除字典缓存的方法
  fastify.decorate('clearDictCache', async (): Promise<void> => {
    if (fastify.redis) {
      try {
        await fastify.redis.del('dict:data:map')
        fastify.log.info('字典映射缓存已清除')
      } catch (error) {
        fastify.log.warn(`清除字典缓存失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  })

}, {
  name: 'dict-map'
  // 可选依赖，不强制要求Redis插件已注册
})

// 扩展Fastify类型定义
declare module 'fastify' {
  interface FastifyInstance {
    /**
     * 获取所有字典映射数据
     */
    getDictMap(): Promise<Record<string, { label: string; value: string }[]>>
    
    /**
     * 获取指定字典类型的数据
     * @param type 字典类型
     */
    getDictByType(type: string): Promise<{ label: string; value: string }[]>
    
    /**
     * 获取字典标签
     * @param type 字典类型
     * @param value 字典值
     */
    getDictLabel(type: string, value: string): Promise<string | undefined>
    
    /**
     * 获取字典值
     * @param type 字典类型
     * @param label 字典标签
     */
    getDictValue(type: string, label: string): Promise<string | undefined>
    
    /**
     * 清除字典缓存
     */
    clearDictCache(): Promise<void>
  }
}