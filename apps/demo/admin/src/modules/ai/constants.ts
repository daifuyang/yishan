/**
 * 与后端 `schemas/ai-chat.schema.ts` 的 AI_PERMISSION.code 保持一致。
 *
 * 单独成文件是为了让公开入口（`../index.ts`）保持「轻」：
 * 权限码是常量，不该拖着 AI SDK 一起进首屏主包。
 */
export const AI_USE_PERMISSION = 'ai:chat:use';
