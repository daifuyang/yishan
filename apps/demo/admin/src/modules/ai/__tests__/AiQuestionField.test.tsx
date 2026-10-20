import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  registerNativeFormOperation,
  registerNativeFieldComponent,
} from '@yishan/core-admin/form-assistance';
import { AiQuestionField } from '../components/AiQuestionField';

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

// Ant Design schedules popup updates through MessageChannel, absent in JSDOM.
Object.defineProperty(globalThis, 'MessageChannel', {
  configurable: true,
  value: class {
    port1 = { onmessage: () => {}, close: () => {} };
    port2 = {
      postMessage: () => setTimeout(() => this.port1.onmessage(), 0),
      close: () => {},
    };
  },
});

it('uses the field registration and preserves independent tree selections', async () => {
  const unregister = registerNativeFormOperation({
    operationId: 'test.create',
    route: '/',
    fieldLabels: {},
    assistancePrompt: '',
    fieldComponents: { deptIds: { component: 'treeSelect' } },
  });
  const onChange = jest.fn();
  render(
    <AiQuestionField
      operationId="test.create"
      field="deptIds"
      multiple
      value={[]}
      disabled={false}
      onChange={onChange}
      options={[
        { value: 1, label: '公司' },
        { value: 2, parentValue: 1, label: '销售部' },
      ]}
    />,
  );
  fireEvent.mouseDown(screen.getByRole('combobox'));
  expect(await screen.findByText('销售部')).toBeTruthy();
  expect(screen.queryByText('公司 / 销售部')).toBeNull();
  fireEvent.click(screen.getByText('销售部'));
  expect(onChange).toHaveBeenLastCalledWith([2]);
  unregister();
});

it('supports a custom registered field component without business branches in the card', () => {
  const removeComponent = registerNativeFieldComponent(
    'test-choice',
    ({ onChange }) => (
      <button type="button" onClick={() => onChange([7])}>
        自定义选择
      </button>
    ),
  );
  const removeOperation = registerNativeFormOperation({
    operationId: 'custom.create',
    route: '/',
    fieldLabels: {},
    assistancePrompt: '',
    fieldComponents: { referenceId: { component: 'test-choice' } },
  });
  const onChange = jest.fn();
  render(
    <AiQuestionField
      operationId="custom.create"
      field="referenceId"
      multiple={false}
      value={[]}
      disabled={false}
      onChange={onChange}
      options={[{ value: 7, label: '候选' }]}
    />,
  );
  fireEvent.click(screen.getByText('自定义选择'));
  expect(onChange).toHaveBeenCalledWith([7]);
  removeOperation();
  removeComponent();
});
