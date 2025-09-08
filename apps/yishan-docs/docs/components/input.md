---
sidebar_position: 2
---

# Input 输入框

用于接收用户输入的基础表单控件。

## 基础用法

### 基本输入框

```tsx
import { Input } from '@yishan/shadcn'

export default function App() {
  return (
    <div className="space-y-4">
      <Input placeholder="请输入用户名" />
      <Input type="email" placeholder="请输入邮箱" />
      <Input type="password" placeholder="请输入密码" />
    </div>
  )
}
```

### 带标签的输入框

```tsx
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium mb-2">用户名</label>
    <Input placeholder="请输入用户名" />
  </div>
  <div>
    <label className="block text-sm font-medium mb-2">邮箱</label>
    <Input type="email" placeholder="请输入邮箱" />
  </div>
</div>
```

### 禁用和只读

```tsx
<div className="space-y-4">
  <Input placeholder="禁用输入框" disabled />
  <Input placeholder="只读输入框" readOnly value="只读内容" />
</div>
```

## 表单集成

### 受控组件

```tsx
import { useState } from 'react'

function LoginForm() {
  const [form, setForm] = useState({
    username: '',
    password: ''
  })

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="用户名"
        value={form.username}
        onChange={(e) => handleChange('username', e.target.value)}
      />
      <Input
        type="password"
        placeholder="密码"
        value={form.password}
        onChange={(e) => handleChange('password', e.target.value)}
      />
    </div>
  )
}
```

### 表单验证

```tsx
import { useState } from 'react'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('请输入有效的邮箱'),
  password: z.string().min(6, '密码至少6位')
})

function ValidatedForm() {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 验证逻辑
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input 
          type="email" 
          placeholder="邮箱"
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
        )}
      </div>
    </form>
  )
}
```

## API

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `type` | `text` \| `email` \| `password` \| `number` | `text` | 输入框类型 |
| `placeholder` | `string` | - | 占位符 |
| `value` | `string` | - | 输入值 |
| `onChange` | `(e: ChangeEvent) => void` | - | 值变化回调 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `readOnly` | `boolean` | `false` | 是否只读 |

## 使用场景

### 搜索框

```tsx
function SearchBar() {
  const [query, setQuery] = useState('')

  return (
    <div className="relative">
      <Input
        placeholder="搜索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10"
      />
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
    </div>
  )
}
```

### 带按钮的输入框

```tsx
function SearchInput() {
  const [value, setValue] = useState('')

  return (
    <div className="flex gap-2">
      <Input
        placeholder="搜索用户"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
      />
      <Button>搜索</Button>
    </div>
  )
}
```