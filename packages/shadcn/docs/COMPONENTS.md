# 组件文档

本组件库提供的所有组件及其使用说明。

## 📋 组件列表

### 🔘 Button 按钮

用于触发操作或事件的交互式元素。

#### 基本用法

```tsx
import { Button } from '@yishan/shadcn';

<Button>默认按钮</Button>
```

#### 变体

| 变体 | 描述 | 示例 |
|------|------|------|
| `default` | 主要按钮 | `<Button variant="default">主要按钮</Button>` |
| `destructive` | 危险操作按钮 | `<Button variant="destructive">删除</Button>` |
| `outline` | 轮廓按钮 | `<Button variant="outline">轮廓按钮</Button>` |
| `secondary` | 次要按钮 | `<Button variant="secondary">次要按钮</Button>` |
| `ghost` | 幽灵按钮 | `<Button variant="ghost">幽灵按钮</Button>` |
| `link` | 链接样式按钮 | `<Button variant="link">链接按钮</Button>` |

#### 尺寸

| 尺寸 | 描述 | 示例 |
|------|------|------|
| `default` | 默认尺寸 | `<Button size="default">默认</Button>` |
| `sm` | 小尺寸 | `<Button size="sm">小按钮</Button>` |
| `lg` | 大尺寸 | `<Button size="lg">大按钮</Button>` |
| `icon` | 图标尺寸 | `<Button size="icon">🔍</Button>` |

#### 完整示例

```tsx
import { Button } from '@yishan/shadcn';

export function ButtonExamples() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="default" size="sm">小按钮</Button>
        <Button variant="default" size="default">默认按钮</Button>
        <Button variant="default" size="lg">大按钮</Button>
      </div>
      
      <div className="flex gap-2">
        <Button variant="default">主要</Button>
        <Button variant="destructive">删除</Button>
        <Button variant="outline">轮廓</Button>
        <Button variant="secondary">次要</Button>
        <Button variant="ghost">幽灵</Button>
        <Button variant="link">链接</Button>
      </div>
    </div>
  );
}
```

#### Props API

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 按钮变体
   * @default "default"
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  
  /**
   * 按钮尺寸
   * @default "default"
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  
  /**
   * 是否使用子元素作为按钮
   * @default false
   */
  asChild?: boolean;
}
```

## 🎨 样式系统

### CSS 变量

组件库使用 CSS 变量定义颜色主题：

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
```

### 暗色主题

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  /* ... 其他暗色变量 */
}
```

## 🧩 响应式设计

所有组件都支持响应式设计，可以通过 Tailwind 的响应式前缀使用：

```tsx
<Button 
  className="w-full sm:w-auto md:w-48"
  variant="default"
>
  响应式按钮
</Button>
```

## ♿ 无障碍访问

所有组件都遵循无障碍设计原则：

- 正确的语义化 HTML
- 键盘导航支持
- 屏幕阅读器支持
- 焦点管理

## 📱 移动端适配

组件在移动端有良好表现：

- 触摸友好的尺寸
- 响应式布局
- 手势支持

## 🔧 自定义主题

### 覆盖默认主题

在使用项目中覆盖 CSS 变量：

```css
:root {
  --primary: 262.1 83.3% 57.8%;
  --primary-foreground: 210 40% 98%;
}
```

### 自定义样式

```tsx
<Button className="bg-custom-color text-custom-foreground">
  自定义按钮
</Button>
```