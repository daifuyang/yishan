import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 模块源码是否存在。下游项目可以删除不需要的模块（如 demo）；依赖某个模块的测试
 * 用它做条件，而不是让整个测试套件因模块缺失而失败。
 */
export const hasModule = (id: string): boolean => existsSync(join(process.cwd(), 'src', 'modules', id, 'module.ts'))
