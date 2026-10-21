import type { ToolPresentationType, ToolRenderer } from './model';

export interface ToolRendererRegistry {
  /** 按展示类型注册。 */
  register(type: ToolPresentationType, renderer: ToolRenderer): void;
  /** 按工具名注册（优先级最高，用于确实特殊的工具）。 */
  registerTool(name: string, renderer: ToolRenderer): void;
  /**
   * 解析渲染器。顺序固定：工具专属 → 展示类型 → 通用兜底。
   *
   * `type` 来自服务端声明的展示契约，**不是**模型给的字符串；即便传进来一个
   * 乱七八糟的值，也只会落到兜底，不会去加载任意组件。
   */
  resolve(type: unknown, name: string): ToolRenderer;
}

/**
 * 创建一张 Renderer 注册表。
 *
 * 注册是**确定**的：同一张表里同一个 key 只能注册一次，重复注册直接抛错，
 * 避免「后注册覆盖先注册」这种取决于 import 顺序的行为。
 */
export function createToolRendererRegistry(
  fallback: ToolRenderer,
): ToolRendererRegistry {
  const types = new Map<string, ToolRenderer>();
  const tools = new Map<string, ToolRenderer>();
  const add = (map: Map<string, ToolRenderer>, key: string, renderer: ToolRenderer) => {
    if (!key || typeof renderer !== 'function') throw new Error(`工具 Renderer 配置无效：${key}`);
    if (map.has(key)) throw new Error(`工具 Renderer 重复注册：${key}`);
    map.set(key, renderer);
  };
  return {
    register(type: ToolPresentationType, renderer: ToolRenderer) {
      add(types, type, renderer);
    },
    registerTool(name: string, renderer: ToolRenderer) {
      add(tools, name, renderer);
    },
    resolve(type: unknown, name: string): ToolRenderer {
      const byTool = tools.get(name);
      if (byTool) return byTool;
      if (typeof type === 'string') {
        const byType = types.get(type);
        if (byType) return byType;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[ai] 未注册的展示类型「${type}」，已回退到通用渲染`);
        }
      }
      return fallback;
    },
  };
}
