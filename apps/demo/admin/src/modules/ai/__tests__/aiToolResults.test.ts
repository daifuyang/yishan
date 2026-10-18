import {
  AI_PREFILL_ROUTES,
  clearAiPrefill,
  consumeAiPrefill,
  peekAiPrefill,
  setAiPrefill,
  subscribeAiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
import { toolResults } from '../adapters/messages';

afterEach(() => {
  clearAiPrefill();
});

describe('AI 表单预填暂存', () => {
  it('把字段交给表单后立即清空，避免刷新后重复带出', () => {
    setAiPrefill({
      target: 'user.create',
      fields: { username: 'zhangsan' },
      missing: ['phone'],
    });
    expect(peekAiPrefill()?.fields).toEqual({ username: 'zhangsan' });
    expect(consumeAiPrefill('user.create')?.fields).toEqual({
      username: 'zhangsan',
    });
    expect(peekAiPrefill()).toBeNull();
    expect(consumeAiPrefill('user.create')).toBeNull();
  });

  it('不把凭据类字段写进暂存', () => {
    setAiPrefill({
      target: 'user.create',
      fields: { username: 'a', password: 'x', token: 'y', secret: 'z' },
      missing: [],
    });
    expect(peekAiPrefill()?.fields).toEqual({ username: 'a' });
  });

  it('丢弃空值字段，避免表单被 undefined 覆盖默认值', () => {
    setAiPrefill({
      target: 'user.create',
      fields: {
        username: 'a',
        nickname: '',
        realName: undefined,
        status: null,
      },
      missing: [],
    });
    expect(peekAiPrefill()?.fields).toEqual({ username: 'a' });
  });

  it('目标不匹配时不交出预填，防止在用户页打开部门表单', () => {
    setAiPrefill({
      target: 'department.create',
      fields: { name: '研发' },
      missing: [],
    });
    expect(consumeAiPrefill('user.create')).toBeNull();
    expect(peekAiPrefill()?.target).toBe('department.create');
  });

  it('订阅者在写入后收到通知', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAiPrefill(listener);
    setAiPrefill({ target: 'user.update', fields: { id: 3 }, missing: [] });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    setAiPrefill({ target: 'user.update', fields: { id: 4 }, missing: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('每个预填目标都绑定到一条固定的后台路由', () => {
    expect(AI_PREFILL_ROUTES['user.create']).toBe('/system/user');
    expect(AI_PREFILL_ROUTES['user.update']).toBe('/system/user');
    expect(AI_PREFILL_ROUTES['department.create']).toBe('/system/department');
    // 白名单里不能出现任意外部地址。
    for (const route of Object.values(AI_PREFILL_ROUTES)) {
      expect(route.startsWith('/system/')).toBe(true);
    }
  });
});

describe('工具结果 part 解析', () => {
  it('把 tool part 的结构化输出取出来，而不是当文本丢掉', () => {
    const message = {
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: '共 3 位用户' },
        {
          type: 'tool-list_users',
          toolCallId: 'c1',
          state: 'output-available',
          input: {},
          output: {
            ok: true,
            render: {
              kind: 'user.table',
              payload: { items: [{ id: 1 }], total: 1 },
            },
          },
        },
      ],
    } as never;
    expect(toolResults(message)).toEqual([
      {
        toolCallId: 'c1',
        capability: 'list_users',
        output: {
          ok: true,
          render: {
            kind: 'user.table',
            payload: { items: [{ id: 1 }], total: 1 },
          },
        },
      },
    ]);
  });

  it('忽略尚未产出结果的工具调用', () => {
    const message = {
      id: 'm2',
      role: 'assistant',
      parts: [
        { type: 'tool-list_users', toolCallId: 'c2', state: 'input-streaming' },
      ],
    } as never;
    expect(toolResults(message)).toEqual([]);
  });
});

describe('预填暂存不会自激通知', () => {
  it('空取不触发订阅回调，否则页面渲染时无限递归爆栈', () => {
    const seen: unknown[] = [];
    const off = subscribeAiPrefill(() => {
      // 模拟 AiPrefillGate 的订阅方：取到就取用。
      const next = consumeAiPrefill('user.create');
      if (next) seen.push(next.fields);
    });
    try {
      // 没有预填时消费：不通知，否则 emit → consume → emit 无限自激。
      consumeAiPrefill('user.create');
      expect(seen).toHaveLength(0);

      setAiPrefill({
        target: 'user.create',
        fields: { username: 'lisi' },
        missing: [],
      });
      expect(seen).toEqual([{ username: 'lisi' }]);
      expect(peekAiPrefill()).toBeNull();
      // 已被订阅方取走，再消费同样不再通知。
      consumeAiPrefill('user.create');
      expect(seen).toHaveLength(1);
    } finally {
      off();
    }
  });
});
