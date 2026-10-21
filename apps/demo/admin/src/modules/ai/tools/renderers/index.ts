import type { ToolRendererRegistry } from '../registry';
import { createToolRendererRegistry } from '../registry';
import { ActionResultRenderer } from './ActionResultRenderer';
import { DescribeOperationRenderer } from './DescribeOperationRenderer';
import { DiscoverOperationsRenderer } from './DiscoverOperationsRenderer';
import { FormPreviewRenderer } from './FormPreviewRenderer';
import { GenericToolRenderer } from './GenericToolRenderer';
import { QueryRenderer } from './QueryRenderer';
import { UpdateFormDraftRenderer } from './UpdateFormDraftRenderer';

/**
 * 默认的 Renderer 注册表。
 *
 * 注册是**集中**的：新增一种展示模式只在这里加一行，不需要动任何调用方。
 *
 * 兜底顺序是固定的：工具专属 → 展示类型 → 通用兜底。新增一个业务工具**不需要**
 * 新增 Renderer——它会落到 `generic`，用统一卡片把参数与结果如实展示出来。
 */
export function createToolRegistry(): ToolRendererRegistry {
  const registry = createToolRendererRegistry(GenericToolRenderer);
  registry.register('generic', GenericToolRenderer);
  registry.register('query', QueryRenderer);
  registry.register('form-preview', FormPreviewRenderer);
  registry.register('action-result', ActionResultRenderer);
  // 工具专属映射：检索结果是一组「业务能力定义」，摊成表格反而没法读，
  // 因此它有自己的列表式展示（见 DiscoverOperationsRenderer）。
  registry.registerTool('discover_operations', DiscoverOperationsRenderer);
  // 读取操作定义与写入草稿都只**记录一件事**：读到了 / 写进草稿了。
  // 表单补全不在工具记录里，而在独立的补全面板里。
  registry.registerTool('describe_operation', DescribeOperationRenderer);
  registry.registerTool('update_form_draft', UpdateFormDraftRenderer);
  return registry;
}

/** 进程内唯一的注册表。 */
export const toolRegistry = createToolRegistry();
