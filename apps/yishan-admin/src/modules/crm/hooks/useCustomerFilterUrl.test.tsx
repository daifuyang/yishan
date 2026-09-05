import { act, renderHook } from '@testing-library/react';
import { useCustomerFilterUrl } from './useCustomerFilterUrl';

let mockSearch = '';
const mockNavigate = jest.fn();
jest.mock('@umijs/max', () => ({
  useLocation: () => ({ pathname: '/crm/customers', search: mockSearch }),
  useNavigate: () => mockNavigate,
}));
beforeEach(() => {
  mockSearch = '';
  mockNavigate.mockClear();
});

it('defaults to all and maps old mine/pool bookmarks to private all', () => {
  const hook = renderHook(() => useCustomerFilterUrl());
  expect(hook.result.current.view).toBe('all');
  for (const legacy of ['mine', 'pool', 'custom']) {
    mockSearch = `?view=${legacy}&poolStatus=public`;
    hook.rerender();
    expect(hook.result.current.view).toBe('all');
    expect(hook.result.current.filters.poolStatus).toBeUndefined();
  }
});

it('resets pagination on tab changes, retains common filters, and follows back/forward URLs', () => {
  mockSearch = '?view=all&page=4&pageSize=20&keyword=云&sourceId=3';
  const hook = renderHook(() => useCustomerFilterUrl());
  act(() => hook.result.current.setView('pending'));
  const target: string = mockNavigate.mock.calls[0][0];
  const params = new URL(target, 'http://localhost').searchParams;
  expect(params.get('view')).toBe('pending');
  expect(params.has('page')).toBe(false);
  expect(params.get('keyword')).toBe('云');
  expect(params.get('sourceId')).toBe('3');
  expect(params.get('pageSize')).toBe('20');
  expect(mockNavigate.mock.calls[0][1]).toEqual({ replace: false });
  mockSearch = `?${params}`;
  hook.rerender();
  expect(hook.result.current.view).toBe('pending');
  expect(hook.result.current.pagination.page).toBe(1);
  mockSearch = '?view=all&page=4&pageSize=20&keyword=云&sourceId=3';
  hook.rerender();
  expect(hook.result.current.view).toBe('all');
  expect(hook.result.current.pagination.page).toBe(4);
  mockSearch = '?view=important&page=1';
  hook.rerender();
  expect(hook.result.current.view).toBe('important');
});
