import iximeiCrmModule from './modules/iximei_crm/module'

/**
 * 安装是显式的。
 *
 * iximei-crm 是独立产品线：只装 system + iximei-crm，不装 demo / shop / portal / ai。
 */
export const iximeiCrmModules = [iximeiCrmModule] as const
