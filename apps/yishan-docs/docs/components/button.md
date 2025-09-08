---
sidebar_position: 1
---

# Button 按钮

用于触发操作或事件的交互元素。

## 基础用法

### 按钮类型

```tsx
import { Button } from '@yishan/shadcn'

export default function App() {
  return (
    <div className="flex gap-2">
      <Button>默认按钮</Button>
      <Button variant="destructive">危险按钮</Button>
      <Button variant="outline">轮廓按钮</Button>
      <Button variant="secondary">次级按钮</Button>
      <Button variant="ghost">幽灵按钮</Button>
      <Button variant="link">链接按钮</Button>
    </div>
  )
}
```

### 按钮尺寸

```tsx
<div className="flex items-center gap-2">
  <Button size="sm">小按钮</Button>
  <Button size="default">默认按钮</Button>
  <Button size="lg">大按钮</Button>
</div>
```

### 图标按钮

```tsx
import { Plus, Download, Trash2 } from 'lucide-react'

<div className="flex gap-2">
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    添加
  </Button>
  <Button variant="outline">
    <Download className="mr-2 h-4 w-4" />
    下载
  </Button>
  <Button variant="destructive">
    <Trash2 className="mr-2 h-4 w-4" />
    删除
  </Button>
</div>
```

## API

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `variant` | `default` \| `destructive` \| `outline` \| `secondary` \| `ghost` \| `link` | `default` | 按钮类型 |
| `size` | `sm` \| `default` \| `lg` | `default` | 按钮尺寸 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `loading` | `boolean` | `false` | 是否加载中 |

## 使用场景

### 表单提交

```tsx
function LoginForm() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    // 处理登录逻辑
    setLoading(false)
  }

  return (
    <Button 
      onClick={handleSubmit}
      disabled={loading}
      className="w-full"
    >
      {loading ? '登录中...' : '登录'}
    </Button>
  )
}
```

### 按钮组合

```tsx
<div className="flex gap-2">
  <Button variant="outline">取消</Button>
  <Button>确认</Button>
</div>
```