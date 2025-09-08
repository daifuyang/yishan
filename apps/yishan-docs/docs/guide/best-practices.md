---
sidebar_position: 4
---

# 最佳实践

## 代码规范

### TypeScript 规范

```typescript
// ✅ 推荐：明确的类型定义
interface User {
  id: string
  name: string
  email: string
}

// ❌ 避免：隐式类型
const user = { id: 1, name: 'John' }
```

### 组件规范

```typescript
// ✅ 推荐：函数组件 + 类型定义
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  onClick?: () => void
}

export function Button({
  variant = 'primary',
  disabled = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    />
  )
}
```

## 文件组织

### 组件文件结构

```
components/
├── ui/
│   ├── button.tsx
│   ├── card.tsx
│   └── index.ts
├── admin/
│   ├── user-table.tsx
│   └── user-form.tsx
└── common/
    ├── layout.tsx
    └── header.tsx
```

### 页面文件结构

```
app/
├── (auth)/
│   ├── login/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   └── register/
│       ├── page.tsx
│       └── layout.tsx
├── (dashboard)/
│   ├── page.tsx
│   └── layout.tsx
└── admin/
    ├── users/
    │   ├── page.tsx
    │   ├── [id]/
    │   │   └── page.tsx
    │   └── layout.tsx
    └── settings/
        └── page.tsx
```

## 性能优化

### 组件优化

```typescript
// ✅ 推荐：使用 useMemo 和 useCallback
import { useMemo, useCallback } from 'react'

function ExpensiveComponent({ items, filter }) {
  const filteredItems = useMemo(() => {
    return items.filter(item => item.category === filter)
  }, [items, filter])

  const handleClick = useCallback((id: string) => {
    // 处理点击事件
  }, [])

  return (
    <div>
      {filteredItems.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  )
}
```

### 图片优化

```typescript
// ✅ 推荐：使用 Next.js Image 组件
import Image from 'next/image'

function Avatar({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="rounded-full"
      priority
    />
  )
}
```

## 状态管理

### 局部状态

```typescript
// ✅ 推荐：使用 useState 管理局部状态
function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  )
}
```

### 全局状态

```typescript
// ✅ 推荐：使用 Zustand 管理全局状态
import { create } from 'zustand'

interface UserStore {
  user: User | null
  setUser: (user: User) => void
  logout: () => void
}

const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))

// 使用
function UserProfile() {
  const { user, logout } = useUserStore()

  if (!user) return null

  return (
    <div>
      <span>{user.name}</span>
      <button onClick={logout}>退出登录</button>
    </div>
  )
}
```

## 错误处理

### API 错误处理

```typescript
// ✅ 推荐：统一的错误处理
async function fetchUsers() {
  try {
    const response = await fetch('/api/users')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch users:', error)
    throw error
  }
}
```

### 组件错误边界

```typescript
// ✅ 推荐：使用 ErrorBoundary
import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <p>出错了: {error.message}</p>
      <button onClick={resetErrorBoundary}>重试</button>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <UserTable />
    </ErrorBoundary>
  )
}
```

## 测试策略

### 组件测试

```typescript
// ✅ 推荐：使用 Testing Library
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

### API 测试

```typescript
// ✅ 推荐：使用 MSW 模拟 API
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: 'John' }]))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## 部署规范

### 环境变量

```bash
# ✅ 推荐：使用 .env 文件
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
DATABASE_URL=postgresql://localhost:5432/mydb
```

### 构建配置

```typescript
// ✅ 推荐：使用 next.config.js
module.exports = {
  images: {
    domains: ['example.com'],
  },
  env: {
    customKey: process.env.CUSTOM_KEY,
  },
}
```