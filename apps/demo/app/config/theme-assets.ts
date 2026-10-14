import { themeTokens } from '@yishan/ui/mobile/theme/palette'
import { TAB_BAR } from '../src/constants'
import type { Compiler } from 'webpack'

interface BuildAsset {
  source(): string | Uint8Array
  size(): number
}
const asset = (value: string): BuildAsset => ({
  source: () => value,
  size: () => Buffer.byteLength(value),
})

// page-meta must be a page template sibling, not an App React node (which is not rendered by WeChat).
export async function applyWechatThemeAssets(assets: Record<string, BuildAsset>) {
  const tabs = new Set<string>(TAB_BAR.list.map((tab) => tab.pagePath))
  for (const [name, source] of Object.entries(assets)) {
    if (!name.endsWith('.wxml') || !assets[name.replace(/\.wxml$/, '.json')]) continue
    const template = source.source().toString()
    if (!template.includes('is="taro_tmpl"') || template.includes('yishanThemeStyle')) continue
    if (template.includes('<page-meta')) throw new Error(`Theme page-meta conflicts with ${name}`)
    const config = JSON.parse(assets[name.replace(/\.wxml$/, '.json')].source().toString()) as {
      navigationStyle?: string
    }
    const top = config.navigationStyle === 'custom' ? '{{yishanSafeTop || 0}}px' : '0px'
    const bottom = tabs.has(name.slice(0, -5)) ? '0px' : '{{yishanSafeBottom || 0}}px'
    assets[name] = asset(
      `<page-meta page-style="{{yishanThemeStyle}};--safe-area-top:${top};--safe-area-bottom:${bottom}" />\n${template}`,
    )
  }
  const nativeTheme = (mode: 'light' | 'dark') => ({
    navigationBarBackgroundColor: themeTokens[mode]['color-bg-surface'],
    navigationBarTextStyle: mode === 'dark' ? 'white' : 'black',
    backgroundColor: themeTokens[mode]['color-bg-base'],
    backgroundTextStyle: mode === 'dark' ? 'light' : 'dark',
    tabBarColor: themeTokens[mode]['color-text-tertiary'],
    tabBarSelectedColor: themeTokens[mode]['color-primary'],
    tabBarBackgroundColor: themeTokens[mode]['color-bg-surface'],
    tabBarBorderStyle: mode === 'dark' ? 'black' : 'white',
  })
  assets['theme.json'] = asset(
    JSON.stringify({ light: nativeTheme('light'), dark: nativeTheme('dark') }, null, 2),
  )
}

export class WechatThemePlugin {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('YishanTheme', (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'YishanTheme',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT + 1,
        },
        async () => {
          const assets = { ...compilation.assets }
          await applyWechatThemeAssets(assets)
          for (const [name, value] of Object.entries(assets)) {
            if (value === compilation.assets[name]) continue
            const source = new compiler.webpack.sources.RawSource(value.source())
            if (compilation.getAsset(name)) compilation.updateAsset(name, source)
            else compilation.emitAsset(name, source)
          }
        },
      )
    })
  }
}
