import type { UIMessage } from 'ai';
import { collectFormPrefills } from '../adapters/formRequests';

function result(
  id: string,
  target = 'user.create',
  fields: Record<string, unknown> = { nickname: '阿伦' },
): UIMessage {
  return {
    id: 'message',
    role: 'assistant',
    parts: [
      {
        type: 'tool-prepare_user_create',
        toolCallId: id,
        state: 'output-available',
        input: {},
        output: {
          ok: true,
          render: {
            kind: 'form.prefill',
            payload: { target, fields, missing: [] },
          },
        },
      },
    ],
  };
}

it('同一轮结果只交给原生表单一次，历史结果预热后不重放', () => {
  const seen = new Set<string>();
  collectFormPrefills([result('old')], seen);
  expect(collectFormPrefills([result('old'), result('new')], seen)).toEqual([
    {
      target: 'user.create',
      fields: { nickname: '阿伦' },
      missing: [],
      requestId: 'new',
    },
  ]);
  expect(collectFormPrefills([result('new')], seen)).toEqual([]);
});

it('拒绝未知表单和没有明确记录 ID 的修改请求', () => {
  expect(
    collectFormPrefills(
      [
        result('unknown', 'custom.form'),
        result('missing-id', 'user.update'),
        result('bad-id', 'user.update', { id: -1 }),
      ],
      new Set(),
    ),
  ).toEqual([]);
});

it('删除只产生原生确认请求，不包含提交能力', () => {
  const message = result('delete');
  message.parts = [
    {
      type: 'tool-prepare_delete_user',
      toolCallId: 'delete',
      state: 'output-available',
      input: {},
      output: {
        ok: true,
        render: {
          kind: 'action.confirm',
          payload: { target: 'user.delete', id: 3 },
        },
      },
    },
  ];
  expect(collectFormPrefills([message], new Set())).toEqual([
    {
      target: 'user.delete',
      fields: { id: 3 },
      missing: [],
      requestId: 'delete',
    },
  ]);
});
