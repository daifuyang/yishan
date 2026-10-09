import { createAdminPlugin } from '@yishan/core-admin/umi-plugin'
import { systemPages } from '@yishan/core-system-admin/umi'

export default createAdminPlugin({ apiRoot: '../api', systemPages })
