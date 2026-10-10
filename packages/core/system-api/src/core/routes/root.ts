import { FastifyPluginAsync } from 'fastify'

// 注意：根路径 / 由 src/core/plugins/external/static.ts 的 redirect 处理
// 这里不再注册 GET /，避免 FST_ERR_DUPLICATED_ROUTE 冲突
const root: FastifyPluginAsync = async (_fastify, _opts): Promise<void> => {
  // 空占位插件，保留文件以避免其他引用失效
  // 实际健康检查已移到 src/core/routes/api/health.ts → /api/health
}

export default root