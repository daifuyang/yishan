import { buildQueryFromView, SYSTEM_VIEWS } from './customerViewFilters';

it('offers only three private-customer tabs', () => {
  expect(SYSTEM_VIEWS.map((v) => v.name)).toEqual([
    '全部',
    '待跟进',
    '重点客户',
  ]);
});
it('keeps common filters but cannot override the tab domain', () => {
  expect(
    buildQueryFromView('all', {
      poolStatus: 'public',
      keyword: '测试',
      page: 2,
    }),
  ).toMatchObject({
    view: 'all',
    poolStatus: 'owned',
    keyword: '测试',
    page: 2,
  });
  expect(
    buildQueryFromView('important', { level: 'C', ownerUserId: 8 }),
  ).toMatchObject({
    view: 'important',
    level: 'C',
    ownerUserId: 8,
    poolStatus: 'owned',
  });
  expect(buildQueryFromView('pending')).toMatchObject({
    view: 'pending',
    poolStatus: 'owned',
  });
});
