import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import CustomerContactCell from './CustomerContactCell';
import { formatPhone } from '../../utils/formatPhone';

const writeText = jest.fn<Promise<void>, [string]>();
const success = jest.fn();
const error = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  success.mockClear();
  error.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  jest
    .spyOn(App, 'useApp')
    .mockReturnValue({ message: { success, error } } as unknown as ReturnType<
      typeof App.useApp
    >);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('formats only 11 digit numbers and preserves nonstandard or masked values', () => {
  expect(formatPhone('13800001010')).toBe('138 0000 1010');
  for (const phone of [
    '021-12345678',
    '+86 13800001010',
    '138****1010',
    '123',
    'abcdefghijk',
  ]) {
    expect(formatPhone(phone)).toBe(phone);
  }
  expect(formatPhone(null)).toBe('');
});

it('copies the raw number, stops row clicks, confirms success and resets after 1.5 seconds', async () => {
  const onRowClick = jest.fn();
  render(
    React.createElement(
      'div',
      { onClick: onRowClick },
      React.createElement(CustomerContactCell, {
        name: '唐悦',
        phone: '13800001010',
      }),
    ),
  );
  expect(screen.getByText('138 0000 1010')).toBeTruthy();
  const button = screen.getByRole('button', { name: '复制手机号' });
  button.focus();
  expect(document.activeElement).toBe(button);
  await act(async () => fireEvent.click(button));
  expect(writeText).toHaveBeenCalledWith('13800001010');
  expect(onRowClick).not.toHaveBeenCalled();
  expect(success).toHaveBeenCalledWith({
    content: '手机号已复制',
    duration: 1.5,
  });
  expect(button.querySelector('[data-icon="check"]')).not.toBeNull();
  act(() => jest.advanceTimersByTime(1500));
  expect(button.querySelector('[data-icon="copy"]')).not.toBeNull();
  fireEvent.click(screen.getByText('唐悦'));
  expect(onRowClick).toHaveBeenCalledTimes(1);
});

it.each([null, '', '   '])(
  'keeps a second-line placeholder without copy when phone is %p',
  (phone) => {
    render(React.createElement(CustomerContactCell, { name: '唐悦', phone }));
    expect(screen.getByText('唐悦')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  },
);

it('copies masked values as-is without exposing a separate raw value', async () => {
  render(
    React.createElement(CustomerContactCell, {
      name: '唐悦',
      phone: '138****1010',
    }),
  );
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(writeText).toHaveBeenCalledWith('138****1010');
});

it('handles denied clipboard access without false success or row navigation', async () => {
  writeText.mockRejectedValue(new Error('Denied'));
  render(
    React.createElement(CustomerContactCell, {
      name: '唐悦',
      phone: '13800001010',
    }),
  );
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(success).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
  expect(
    screen.getByRole('button').querySelector('[data-icon="copy"]'),
  ).not.toBeNull();
});

it('handles an unavailable clipboard API', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  render(
    React.createElement(CustomerContactCell, {
      name: '唐悦',
      phone: '13800001010',
    }),
  );
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(success).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
});

it('does not update a recycled cell after a pending copy completes', async () => {
  let complete: (() => void) | undefined;
  writeText.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const view = render(
    React.createElement(CustomerContactCell, {
      name: '唐悦',
      phone: '13800001010',
    }),
  );
  fireEvent.click(screen.getByRole('button'));
  view.rerender(
    React.createElement(CustomerContactCell, {
      name: '陈明',
      phone: '13800001001',
    }),
  );
  await act(async () => complete?.());
  expect(success).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button').querySelector('[data-icon="copy"]'),
  ).not.toBeNull();
});
