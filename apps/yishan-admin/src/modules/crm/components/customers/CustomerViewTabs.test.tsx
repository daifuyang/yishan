import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import CustomerViewTabs from './CustomerViewTabs';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
});

describe('CustomerViewTabs', () => {
  it('renders system views as tabs and reports the selected view', () => {
    const onChange = jest.fn();

    render(<CustomerViewTabs value="all" onChange={onChange} />);

    expect(screen.queryByRole('tab', { name: '全部客户' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '我的客户' })).toBeNull();
    expect(
      screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByText('自定义视图')).toBeNull();
    expect(screen.queryByRole('tab', { name: '公海' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '待跟进' }));

    expect(onChange).toHaveBeenCalledWith('pending');
  });
});
