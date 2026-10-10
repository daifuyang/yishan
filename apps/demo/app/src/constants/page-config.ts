// app.config 与应用入口校验共用静态页面清单；分包页面也在此登记。
export const PAGE_CONFIG: {
  pages: string[]
  subPackages: { root: string; pages: string[] }[]
} = {
  pages: [
    'pages/index/index',
    'pages/apps/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/messages/index',
    'pages/settings/index',
    'pages/security/index',
    'pages/about/index',
    'pages/profile/edit/index',
    'pages/profile/password/index',
    'pages/profile/login-log/index',
    'pages/contacts/index/index',
    'pages/contacts/dept/index',
    'pages/system/login-log/index',
    'pages/system/dept/index',
    'pages/system/dept/detail/index',
    'pages/system/user/index',
    'pages/system/user/detail/index',
    'pages/system/user/edit/index',
    'pages/system/dict/index',
    'pages/system/dict/items/index',
  ],
  subPackages: [],
}

export function isRegisteredPage(path: string): boolean {
  const page = path.split('?')[0].replace(/^\/+/, '')
  return (
    PAGE_CONFIG.pages.includes(page) ||
    PAGE_CONFIG.subPackages.some((pkg) =>
      pkg.pages.some((entry) => `${pkg.root}/${entry}` === page),
    )
  )
}
