import { act, renderHook } from '@testing-library/react';
import {
  clearNativeFormHandles,
  invalidateNativeFormHandle,
  isCurrentNativeFormHandle,
  peekNativeFormHandle,
  peekNativeFormOperation,
  registerNativeFormOperation,
  registerNativeFormHandle,
  restoreNativeFormHandle,
  useAiForm,
  type NativeFormHandle,
} from '@yishan/core-admin/form-assistance';

const operation = {
  operationId: 'ticket.create',
  route: '/ticket',
  fieldLabels: { subject: '主题' },
  assistancePrompt: '完善工单',
};
function handle(): NativeFormHandle {
  let revision = 0;
  let subject = '';
  const snapshot = () => ({
    target: operation.operationId,
    instanceId: 'ticket#1',
    revision,
    fields: { subject },
    dirtyFields: [],
  });
  return {
    snapshot,
    open: async () => snapshot(),
    apply: async (input) => {
      if (input.instanceId !== 'ticket#1')
        return { applied: false, conflicts: ['__instance__'] };
      if (input.baseRevision !== revision)
        return { applied: false, conflicts: ['__revision__'] };
      subject = String(input.fields.subject);
      revision += 1;
      return { applied: true, conflicts: [] };
    },
  };
}
afterEach(clearNativeFormHandles);
it('a third operation registers, fills and unregisters without business-specific coordination', async () => {
  const removeOperation = registerNativeFormOperation(operation);
  const form = handle();
  const { unmount } = renderHook(() =>
    useAiForm({ handle: form, identity: 1 }),
  );
  expect(peekNativeFormOperation('ticket.create')).toEqual(operation);
  expect(isCurrentNativeFormHandle(form)).toBe(true);
  const active = currentHandle();
  expect(
    await active.apply({
      instanceId: 'ticket#1',
      baseRevision: 0,
      fields: { subject: '排查' },
    }),
  ).toEqual({ applied: true, conflicts: [] });
  expect(active.snapshot().fields.subject).toBe('排查');
  expect(
    await active.apply({
      instanceId: 'ticket#1',
      baseRevision: 0,
      fields: { subject: '迟到' },
    }),
  ).toEqual({ applied: false, conflicts: ['__revision__'] });
  expect(
    await active.apply({ instanceId: 'old', baseRevision: 1, fields: {} }),
  ).toEqual({ applied: false, conflicts: ['__instance__'] });
  unmount();
  expect(peekNativeFormHandle('ticket.create')).toBeNull();
  expect(
    await active.apply({ instanceId: 'ticket#1', baseRevision: 1, fields: {} }),
  ).toEqual({ applied: false, conflicts: ['__target__'] });
  removeOperation();
  expect(peekNativeFormOperation('ticket.create')).toBeNull();
});
it('identity changes invalidate retained handles and old cleanup cannot remove replacements', async () => {
  const first = handle();
  const second = handle();
  const cleanup = registerNativeFormHandle(first, 1);
  const old = currentHandle();
  registerNativeFormHandle(second, 2);
  cleanup();
  expect(isCurrentNativeFormHandle(second)).toBe(true);
  expect(
    await old.apply({ instanceId: 'ticket#1', baseRevision: 0, fields: {} }),
  ).toEqual({ applied: false, conflicts: ['__target__'] });
});
it('target invalidation and restoration remain scoped to their operation', () => {
  const form = handle();
  const { unmount } = renderHook(() =>
    useAiForm({ handle: form, identity: 1 }),
  );
  act(() => invalidateNativeFormHandle('ticket.create', 'editing'));
  expect(peekNativeFormHandle('ticket.create')).toBeNull();
  act(() => restoreNativeFormHandle('ticket.create', 'closed'));
  expect(isCurrentNativeFormHandle(form)).toBe(true);
  unmount();
});

function currentHandle(): NativeFormHandle {
  const current = peekNativeFormHandle('ticket.create');
  if (!current) throw new Error('Ticket form is not registered');
  return current;
}

it('useAiForm invalidates retained references when identity changes with the same adapter', async () => {
  const form = handle();
  const { rerender, unmount } = renderHook(
    ({ identity }) => useAiForm({ handle: form, identity }),
    { initialProps: { identity: 1 } },
  );
  const previous = currentHandle();
  rerender({ identity: 2 });
  expect(
    await previous.apply({
      instanceId: 'ticket#1',
      baseRevision: 0,
      fields: { subject: '旧身份' },
    }),
  ).toEqual({ applied: false, conflicts: ['__target__'] });
  expect(form.snapshot().fields.subject).toBe('');
  expect(
    await currentHandle().apply({
      instanceId: 'ticket#1',
      baseRevision: 0,
      fields: { subject: '当前身份' },
    }),
  ).toEqual({ applied: true, conflicts: [] });
  unmount();
});
