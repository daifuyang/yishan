import type { UIMessage } from 'ai';
import {
  AI_PREFILL_ROUTES,
  type AiPrefill,
  type AiPrefillTarget,
} from '@yishan/core-system-admin/ai-prefill';
import { trustedRender } from '../tools/adapter';
import { toolResults } from './messages';

export function collectFormPrefills(
  messages: UIMessage[],
  seen: Set<string>,
): AiPrefill[] {
  const requests: AiPrefill[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const result of toolResults(message)) {
      if (seen.has(`ui:${result.toolCallId}`)) continue;
      // `render.kind` 只由 `trustedRender` 解读：展示层与动作层共用同一套语义。
      const render = trustedRender(result.output);
      if (!render) continue;
      if (render.kind !== 'form.prefill' && render.kind !== 'action.confirm')
        continue;
      const payload = render.payload;
      if (
        typeof payload.target !== 'string' ||
        !Object.hasOwn(AI_PREFILL_ROUTES, payload.target)
      )
        continue;
      const target = payload.target as AiPrefillTarget;
      const fields =
        render.kind === 'action.confirm' ? { id: payload.id } : payload.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields))
        continue;
      if (
        (target === 'user.update' || target === 'user.delete') &&
        (!Number.isSafeInteger((fields as Record<string, unknown>).id) ||
          Number((fields as Record<string, unknown>).id) < 1)
      )
        continue;
      seen.add(`ui:${result.toolCallId}`);
      requests.push({
        target,
        fields: fields as Record<string, unknown>,
        missing: Array.isArray(payload.missing)
          ? payload.missing.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
        requestId: result.toolCallId,
      });
    }
  }
  return requests;
}
