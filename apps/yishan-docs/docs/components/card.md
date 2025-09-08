---
sidebar_position: 3
---

# Card 卡片

用于展示内容的容器组件，提供一致的视觉样式。

## 基础用法

### 基础卡片

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zerocmf/yishan-shadcn'

export default function App() {
  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>卡片标题</CardTitle>
        <CardDescription>卡片描述信息</CardDescription>
      </CardHeader>
      <CardContent>
        <p>卡片内容区域</p>
      </CardContent>
    </Card>
  )
}
```

### 完整卡片

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zerocmf/yishan-shadcn'

export default function CompleteCard() {
  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>创建项目</CardTitle>
        <CardDescription>为你的团队部署一个新项目</CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="name">项目名称</label>
              <Input id="name" placeholder="输入项目名称" />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="framework">框架</label>
              <select id="framework">
                <option>Next.js</option>
                <option>SvelteKit</option>
                <option>Astro</option>
                <option>Nuxt.js</option>
              </select>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">取消</Button>
        <Button>创建</Button>
      </CardFooter>
    </Card>
  )
}
```

## 使用场景

### 用户信息卡片

```tsx
function UserCard({ user }) {
  return (
    <Card className="w-[300px]">
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">角色</span>
            <span className="text-sm">{user.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">状态</span>
            <Badge variant={user.active ? 'default' : 'secondary'}>
              {user.active ? '活跃' : '禁用'}
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">编辑用户</Button>
      </CardFooter>
    </Card>
  )
}
```

### 统计卡片

```tsx
function StatCard({ title, value, description, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-gray-500">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500">{description}</p>
      </CardContent>
    </Card>
  )
}

// 使用示例
<StatCard
  title="总收入"
  value="$45,231.89"
  description="较上月增长 20.1%"
  icon={<DollarSign className="h-4 w-4" />}
/>
```

### 数据展示卡片

```tsx
function DataCard({ title, data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>{item.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

## API

### Card 属性

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `className` | `string` | - | 自定义样式类 |

### 子组件

- `CardHeader` - 卡片头部
- `CardTitle` - 卡片标题
- `CardDescription` - 卡片描述
- `CardContent` - 卡片内容
- `CardFooter` - 卡片底部

## 响应式设计

```tsx
// 响应式卡片
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <Card className="w-full">
    {/* 卡片内容 */}
  </Card>
  <Card className="w-full">
    {/* 卡片内容 */}
  </Card>
</div>
```