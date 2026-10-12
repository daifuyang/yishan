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
    'pages/security/index',
    'pages/about/index',
    'pages/profile/edit/index',
    'pages/profile/password/index',
    'pages/profile/login-log/index',
    'pages/contacts/index/index',
    'pages/contacts/dept/index',
    'pages/system/login-log/index',
    'pages/system/login-log/detail/index',
    'pages/system/dept/index',
    'pages/system/dept/detail/index',
    'pages/system/dept/form/index',
    'pages/system/user/index',
    'pages/system/user/detail/index',
    'pages/system/user/edit/index',
    'pages/system/user/departments/index',
    'pages/system/user/roles/index',
    'pages/system/dict/index',
    'pages/system/dict/items/index',
    'pages/system/dict/detail/index',
    'pages/system/dict/form/index',
    'pages/system/dict/items/detail/index',
    'pages/system/dict/items/form/index',
    'pages/system/role/index', 'pages/system/role/detail/index',
    'pages/system/role/form/index', 'pages/system/role/permissions/index',
    'pages/system/role/workbench/index',
    'pages/system/position/index',
    'pages/system/position/detail/index',
    'pages/system/position/form/index',
    'pages/system/menu/index',
    'pages/system/menu/detail/index',
    'pages/system/menu/form/index',
    'pages/system/menu/permissions/index',
    'pages/system/app-menu/index',
    'pages/system/app-menu/detail/index',
    'pages/system/app-menu/form/index',
    'pages/system/region/index',
    'pages/system/site/index',
    'pages/system/site/basic/index',
    'pages/system/site/seo/index',
    'pages/system/site/filing/index',
    'pages/system/storage/index',
    'pages/system/storage/basic/index',
    'pages/system/storage/access/index',
    'pages/system/storage/upload/index',
    'pages/system/attachments/index',
    'pages/system/attachments/detail/index',
    'pages/system/attachments/form/index',
    'pages/system/attachments/import/index',
    'pages/system/attachments/folders/index',
    'pages/system/attachments/folder-form/index',
    'pages/system/module-management/index',
    'pages/system/module-management/detail/index',
    'pages/demo/quickstart/index',
    'pages/demo/health/index',
    'pages/demo/todos/index',
    'pages/demo/region/index',
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
