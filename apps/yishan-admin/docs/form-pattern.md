# 表单模式（DrawerForm + FormEditor）

> 本文是 portal / shop 后台页面沉淀下来的 **CRUD 模板**。
>
> 配套文档：
> - 页面注册机制（怎么挂到菜单）→ 本目录 `module-pages.md`
> - 后端模块规范 → `apps/yishan-api/docs/module-pattern.md`

## 1. 整体骨架

每个后台页面都是同一个形态：

```
PageContainer
  └── ProTable<T>            ← 列表 + 搜索 + 行操作
        └── toolBarRender    ← "新建" 按钮
        └── request          ← 调 openapi 生成函数
        └── columns[]        ← 字段定义
        └── rowSelection
  └── DrawerForm             ← 新建 / 编辑抽屉
        └── ProForm 系列字段
        └── onFinish         ← 调 openapi 生成函数
        └── FormEditor       ← 富文本（content 类）
        └── ProFormList      ← 动态键值对（attributes 类）
```

完整参考：`apps/yishan-admin/src/modules/portal/pages/articles/index.tsx`。

## 2. 标配 props

这些 props 几乎每个页面都用，**保持一致**是 visual parity 的关键：

```tsx
<PageContainer>
  <ProTable ... />
  <DrawerForm
    title={editingId ? '编辑' : '新建'}
    open={drawerOpen}
    onOpenChange={setDrawerOpen}
    grid
    drawerProps={{
      destroyOnClose: true,
      maskClosable: false,
      width: 800,
    }}
    initialValues={formValues}
    onFinish={async (values) => { /* ... */ return true }}
  >
    {/* 字段 */}
  </DrawerForm>
</PageContainer>
```

| prop | 用途 | 不要 |
|---|---|---|
| `grid` | 启用栅格，配合 `colProps={{ span: 12 }}` 双列 | 不要每个字段都 `colProps={{ span: 24 }}` |
| `destroyOnClose: true` | 关闭后销毁内部表单项，避免残留值 | 不要 false（容易脏数据） |
| `maskClosable: false` | 防止误触关闭丢失未提交内容 | 不要 true |
| `width: 800` | 抽屉宽度，针对主内容是 1-2 个字段的可调 600 | 不要全宽 1200（覆盖视野） |

## 3. ProTable 字段表

### 3.1 状态 / 枚举字段

```tsx
const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '草稿', status: 'Default' },
  '1': { text: '已发布', status: 'Success' },
}

columns = [{
  title: '状态',
  dataIndex: 'status',
  valueEnum: statusEnum,
  width: 80,
}]
```

**不要**手写：

```tsx
// ✘ 别这样
render: (_, r) => <Tag>{r.status === 1 ? '已发布' : '草稿'}</Tag>
```

`valueEnum` 让 ProTable 自动渲染带颜色 badge，与 `system/user` 表一致。

### 3.2 时间字段

```tsx
columns = [{
  title: '发布时间',
  dataIndex: 'publishTime',
  search: false,
  valueType: 'dateTime',
  width: 160,
}]
```

`valueType: 'dateTime'` 走系统默认格式化。**不要** `render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss')`——已经由 `valueType` 接管。

### 3.3 操作列

```tsx
columns = [{
  title: '操作',
  dataIndex: 'option',
  valueType: 'option',
  fixed: 'right',
  width: 180,
  render: (_, record) => (
    <Space size={12}>
      <a onClick={() => handleEdit(record.id)}>编辑</a>
      <a onClick={() => handlePublishToggle(record)}>发布</a>
      <Popconfirm
        title="确定要删除吗？"
        onConfirm={() => handleRemove(record.id)}
      >
        <a style={{ color: '#ff4d4f' }}>删除</a>
      </Popconfirm>
    </Space>
  ),
}]
```

要点：

- `dataIndex: 'option'` + `valueType: 'option'` + `fixed: 'right'` + `width: 160`（多个动作可加到 180 / 200）
- 用 `<a>` 而不是 `<Button type="link">`，与 `system/user` 视觉一致
- 删除用 `Popconfirm` 二次确认

## 4. DrawerForm 字段

### 4.1 文本输入

```tsx
<ProFormText
  name="title"
  label="标题"
  placeholder="请输入标题"
  colProps={{ span: 12 }}
  rules={[{ required: true, message: '请输入标题' }]}
/>
```

### 4.2 富文本（content 类）

```tsx
import { FormEditor } from 'yishan-tiptap'
import { ProForm } from '@ant-design/pro-components'

<ProForm.Item
  name="content"
  label="正文"
  colProps={{ span: 24 }}
  rules={[{ required: true, message: '请输入正文' }]}
>
  <FormEditor minHeight={300} />
</ProForm.Item>
```

`FormEditor` 来自 `yishan-tiptap` 包，做到 `pnpm --filter yishan-tiptap build` 后即可使用。

### 4.3 动态键值对（attributes）

attributes 是 json 字段，在 admin 表单上最自然的呈现是双列键值对：

```tsx
<ProFormList
  name="attributesList"
  label="自定义属性"
  colProps={{ span: 24 }}
  creatorButtonProps={{ position: 'bottom', creatorButtonText: '新增属性' }}
>
  <ProFormText name="key"   label="键" colProps={{ span: 12 }} />
  <ProFormText name="value" label="值" colProps={{ span: 12 }} />
</ProFormList>
```

在 `onFinish` 里再收成对象：

```tsx
onFinish={async (values) => {
  const attrs = Array.isArray(values.attributesList)
    ? (values.attributesList as Array<{ key: string; value: string }>)
        .filter((a) => a.key?.trim())
        .reduce((acc, cur) => {
          acc[cur.key.trim()] = cur.value
          return acc
        }, {} as Record<string, unknown>)
    : {}
  const payload = { ...values, attributes: Object.keys(attrs).length > 0 ? attrs : undefined }
  // ...
}}
```

### 4.4 多选 / 标签

```tsx
<ProFormSelect
  name="categoryIds"
  label="所属分类"
  mode="multiple"
  colProps={{ span: 24 }}
  request={async () => {
    const res = await getPortalV1Categories({ page: 1, pageSize: 100 })
    return (res as unknown as { items: { id: number; name: string }[] }).items.map((c) => ({
      label: c.name, value: c.id,
    }))
  }}
/>

<ProFormSelect
  name="tags"
  label="标签"
  mode="tags"        // 允许输入新值
  colProps={{ span: 24 }}
  fieldProps={{ tokenSeparators: [','] }}
/>
```

- `mode="multiple"` 限定在已有选项里选
- `mode="tags"` 允许输入新值，回车 / 逗号分隔

### 4.5 日期时间

```tsx
<ProFormDateTimePicker
  name="publishTime"
  label="发布时间"
  colProps={{ span: 12 }}
  fieldProps={{ style: { width: '100%' } }}
  transform={(v: any) => {
    if (!v) return { publishTime: undefined }
    if (typeof v === 'string') return { publishTime: v }
    if (v?.format) return { publishTime: v.format('YYYY-MM-DD HH:mm:ss') }
    return { publishTime: undefined }
  }}
/>
```

`transform` 统一把 dayjs 对象转成 'YYYY-MM-DD HH:mm:ss' 字符串，避免后端 schema 校验失败。

### 4.6 开关

```tsx
<ProFormSwitch name="isPinned" label="置顶" colProps={{ span: 12 }} />
```

## 5. 调用 openapi 生成函数

```ts
import {
  deletePortalV1ArticlesId,
  getPortalV1Articles,
  getPortalV1ArticlesId,
  patchPortalV1ArticlesId,
  postPortalV1Articles,
  postPortalV1ArticlesIdPublish,
} from '@/services/generated/portal'
```

约定：

- 命名：`<verb><Module>V1<Path>`，全是动词开头
- 入参：第一个参数是 path/query params，第二个是 body
- 类型签名与 `@/services/generated/<module>.ts` 完全同步

修改后端 schema 后必须跑：

```bash
pnpm --filter yishan-admin openapi
```

否则 TS 编译会失配。

## 6. 数据双向转换

openapi 生成函数返回的 `status` 是 `number`，但 `valueEnum` 要 `string`：

```tsx
request={async (params) => {
  const { current, pageSize, ...restParams } = params
  const result = await getPortalV1Articles({
    page: current,
    pageSize,
    keyword: restParams.keyword as string | undefined,
    status: restParams.status === '0' || restParams.status === '1'
      ? Number(restParams.status) : undefined,
  })
  const payload = result as unknown as { items?: PortalArticle[]; total?: number }
  const items = (payload.items ?? []).map((item) => ({
    ...item,
    status: Number(item.status),  // 确保到前端是 number
  }))
  return { data: items, success: true, total: payload.total ?? 0 }
}}
```

回传时：

```tsx
const statusValue = values.status === '0' || values.status === '1' ? Number(values.status) : 0
const payload = { ..., status: statusValue }
```

**编辑回填**也要做对应转换：

```tsx
const handleEdit = async (id: number) => {
  const res = await getPortalV1ArticlesId({ id })
  const data = res as unknown as PortalArticle
  if (data) {
    setFormValues({
      ...data,
      status: String(data.status),  // Form 内部用 string
    })
    setEditingId(id)
    setDrawerOpen(true)
  }
}
```

## 7. 状态管理

每个页面维护这几个 state：

```tsx
const actionRef = useRef<ActionType>(null)              // 触发 ProTable reload
const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
const [drawerOpen, setDrawerOpen] = useState(false)
const [editingId, setEditingId] = useState<number | undefined>(undefined)
const [formValues, setFormValues] = useState<Record<string, any>>({ status: '0' })

const handleSuccess = () => {
  setDrawerOpen(false)
  setEditingId(undefined)
  setFormValues({ status: '0' })
  actionRef.current?.reload()
}
```

成功后一定要 reset 到初始值，避免下次打开 dirty。

## 8. 常见错误

| 现象 | 原因 | 修 |
|---|---|---|
| `valueEnum` 不显示颜色 | 服务端返回的是 number，ProTable 字符串比对失败 | `setFormValues` 时 `String(...)` |
| DrawerForm 关闭后字段残留 | 缺 `destroyOnClose: true` | 加 |
| 编辑保存后点删除错乱 | `editingId` 没 reset | `handleSuccess` 加上 `setEditingId(undefined)` |
| attributesList 加了字段但提交后没存 | `onFinish` 没把 list 收成 object | 写收对象那段 |
| 表格操作列窄 | 多个动作但 `width: 160` | 加到 180 / 200 |
