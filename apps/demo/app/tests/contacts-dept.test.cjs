const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function renderDepartment(name) {
  const titles = []
  const Page = loadTs('src/pages/contacts/dept/index.tsx', {
    react: {
      useState: (initial) => [initial, () => {}],
      useEffect: (effect) => effect(),
    },
    '@tarojs/components': { View: 'view', Text: 'text' },
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: '1', name } }),
      setNavigationBarTitle: ({ title }) => titles.push(title),
    },
    '@/components/atoms': { Avatar: 'avatar', AppText: 'app-text' },
    '@/components/molecules': { ListItem: 'list-item', SectionHeader: 'section-header' },
    '@/components/layout': { PageContainer: 'page-container' },
    '@/api': { contactsApi: { getDeptUsers: async () => [] } },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    './index.module.scss': {},
  }).default
  const tree = Page()
  return { heading: tree.props.children[0].props.title, title: titles[0] }
}

test('department detail decodes the route name for its heading and navigation title', () => {
  const result = renderDepartment('%E4%B8%8A%E6%B5%B7%E6%80%BB%E5%85%AC%E5%8F%B8')
  assert.equal(result.heading, '上海总公司')
  assert.equal(result.title, '上海总公司成员')
})

test('department detail accepts plain names, missing names and malformed percent escapes', () => {
  for (const [input, expected] of [
    ['研发部', '研发部'],
    [undefined, '部门'],
    ['', '部门'],
    ['销售100%', '销售100%'],
    ['%E4%B8', '%E4%B8'],
    ['研发%26支持%2B服务', '研发&支持+服务'],
  ]) {
    const result = renderDepartment(input)
    assert.equal(result.heading, expected)
    assert.equal(result.title, `${expected}成员`)
  }
})
