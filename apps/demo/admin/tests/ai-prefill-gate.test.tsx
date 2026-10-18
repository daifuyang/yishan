import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { AiPrefillGate } from '@yishan/core-system-admin/components/AiPrefillGate';
import {
  clearAiPrefill,
  setAiPrefill,
  subscribeAiPrefillResults,
} from '@yishan/core-system-admin/ai-prefill';
afterEach(clearAiPrefill);
it('已打开记录 A 时拒绝切换到 B，保留当前表单身份', () => {
  const result = jest.fn();
  const unsubscribe = subscribeAiPrefillResults(result);
  const view = render(
    <AiPrefillGate target="user.update">
      {({ initialValues }) => <div>记录：{String(initialValues.id)}</div>}
    </AiPrefillGate>,
  );
  act(() =>
    setAiPrefill({
      target: 'user.update',
      fields: { id: 1 },
      missing: [],
      requestId: 'a',
    }),
  );
  expect(screen.getByText('记录：1')).toBeTruthy();
  act(() =>
    setAiPrefill({
      target: 'user.update',
      fields: { id: 2 },
      missing: [],
      requestId: 'b',
    }),
  );
  expect(screen.getByText('记录：1')).toBeTruthy();
  expect(result).toHaveBeenCalledWith(
    expect.objectContaining({ requestId: 'b', status: 'failed' }),
  );
  view.unmount();
  unsubscribe();
});
