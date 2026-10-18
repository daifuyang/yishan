import {
  clearAiPrefill,
  consumeAiPrefill,
  peekAiPrefill,
  registerAiPrefillHandler,
  setAiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
afterEach(clearAiPrefill);
it('does not let an unrelated form consume the pending request', () => {
  setAiPrefill({
    target: 'user.create',
    fields: { realName: '新用户' },
    missing: [],
  });
  expect(consumeAiPrefill('user.update')).toBeNull();
  expect(consumeAiPrefill('user.create')?.fields).toEqual({
    realName: '新用户',
  });
});
it('routes patches to an already open matching form and filters sensitive/unknown fields', () => {
  const handler = jest.fn(() => true);
  const unregister = registerAiPrefillHandler('user.update', handler);
  try {
    setAiPrefill({
      target: 'user.update',
      fields: { id: 7, realName: '新姓名', password: 'private', isAdmin: true },
      missing: [],
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { id: 7, realName: '新姓名' } }),
    );
    expect(peekAiPrefill()).toBeNull();
  } finally {
    unregister();
  }
});
it('prepares deletion without running any delete API', () => {
  setAiPrefill({ target: 'user.delete', fields: { id: 7 }, missing: [] });
  expect(consumeAiPrefill('user.delete')?.fields).toEqual({ id: 7 });
});
