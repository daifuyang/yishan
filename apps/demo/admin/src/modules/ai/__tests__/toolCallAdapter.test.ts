import type { UIMessage } from 'ai';
import { toToolCalls } from '../tools/adapter';
import { safeValue } from '../tools/safe-data';

const message = (parts: unknown[]): UIMessage => ({ id: 'm', role: 'assistant', parts: parts as UIMessage['parts'] });
const call = (id: string, state: string, extra: Record<string, unknown> = {}) => ({ type: 'tool-query_business_data', toolCallId: id, state, input: { operationId: 'user.list', params: { keyword: '张三' } }, ...extra });

it('keeps stable ids, terminal outcomes and independent parallel calls', () => {
  const tools = toToolCalls(message([
    call('a', 'input-streaming'), call('b', 'input-available'),
    call('a', 'output-available', { output: { ok: true, render: { kind: 'user.table', payload: { items: [{ id: 1 }], total: 1 } } } }),
    call('a', 'input-available'), call('a', 'output-error', { errorText: '迟到的错误' }),
  ]), true);
  expect(tools).toHaveLength(2);
  expect(tools[0]).toMatchObject({ id: 'a', status: 'success', presentation: { type: 'query' } });
  expect(tools[1]).toMatchObject({ id: 'b', status: 'running' });
  expect(toToolCalls(message([call('b', 'input-streaming')]), false)[0].status).toBe('cancelled');
});

it('uses a safe generic fallback for dynamic, unknown and malformed tools', () => {
  const tools = toToolCalls(message([
    { type: 'dynamic-tool', toolName: 'external_lookup', toolCallId: 'dynamic', state: 'output-available', input: { description: '查询库存' }, output: { arbitrary: true } },
    call('bad', 'output-available', { output: { ok: true, render: { kind: 'https://evil/component', payload: null } } }),
    null,
  ]), false);
  expect(tools).toHaveLength(2);
  expect(tools.every(tool => tool.presentation.type === 'generic')).toBe(true);
  expect(tools[0].title).toBe('External Lookup');
});

it('does not expose nested credentials or secrets echoed in errors and limits recursive output', () => {
  const value = { input: { password: 'supersecretvalue', headers: { Authorization: 'Bearer verysecret' }, api_key: 'providersecret' }, error: 'bad supersecretvalue providersecret', public: 'ok' };
  const safe = JSON.stringify(safeValue(value));
  expect(safe).not.toContain('supersecretvalue');
  expect(safe).not.toContain('providersecret');
  expect(safe).not.toContain('verysecret');
  expect(safe).toContain('ok');
});

it('does not infer a formal save from natural language or a presentation hint in model input', () => {
  const tool = toToolCalls(message([call('x', 'output-error', { input: { presentation: { type: 'form-preview' }, password: 'never-show' }, errorText: '请求失败' })]), false)[0];
  expect(tool.status).toBe('error');
  expect(tool.presentation.type).toBe('generic');
  expect(JSON.stringify(tool)).not.toContain('never-show');
});
