# TabBar 图标

占位图标（81×81 PNG），由 `.scripts/gen-tabbar-icons.cjs` 一次性脚本生成。

- 普通态：`#86909C` 灰
- 激活态：`#1677FF` 主色（钉钉蓝）

## 替换为真实图标

使用 `sharp` + Tabler/Lucide SVG 批量转换为 PNG：

```bash
# 1. 安装依赖（一次性）
npm i -D sharp

# 2. 写转换脚本，参考知识库：
#    knowledge/03-process/02-standards/taro-scaffold-standards §3.3

# 3. 输出到本目录
```

## 当前图标列表

| 文件 | 状态 | 含义 |
|------|------|------|
| `home.png` / `home-active.png` | 普通 / 激活 | 首页 |
| `apps.png` / `apps-active.png` | 普通 / 激活 | 功能 |
| `user.png` / `user-active.png` | 普通 / 激活 | 我的 |

> 真实项目应替换为矢量导出的高质量图标；占位图标形状是「房子/宫格/人物」简化版本，仅用于通过编译。
