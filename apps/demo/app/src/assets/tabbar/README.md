# TabBar 图标

采用 [Phosphor Icons](https://phosphoricons.com/)（`@phosphor-icons/core` 2.1.1，MIT）的配对图标，转换为六张 81×81 RGBA 透明 PNG。

- 普通态：regular（outline），`#86909C`
- 激活态：fill，`#1677FF`

| Tab | 上游图标 | 输出文件 |
| --- | --- | --- |
| 首页 | house / house-fill | home.png / home-active.png |
| 工作台 | squares-four / squares-four-fill | apps.png / apps-active.png |
| 我的 | user / user-fill | user.png / user-active.png |

SVG 路径来自官方 npm 包，仅设置尺寸和颜色。源文件及完整 MIT 许可保存在 `scripts/tabbar-icons/`。在仓库根目录使用 PowerShell 重新生成：

```powershell
pwsh -File apps/demo/app/scripts/tabbar-icons/generate.ps1
```

脚本通过 npx 使用固定版本的 resvg 转换工具，仅生成时需要网络；不增加项目依赖。H5 和微信小程序共享 `src/constants/index.ts` 中的路径，构建只复制 PNG，不包含 SVG 源文件或图标库。

`tests/tab-icons.test.cjs` 检查所有注册图标的尺寸、透明背景及可见像素。
