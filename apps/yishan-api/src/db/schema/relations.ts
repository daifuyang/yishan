// Generated from drizzle/*.sql. Do not edit manually.
import { relations } from 'drizzle-orm'
import { iximeiCrmCustomer, iximeiCrmCustomerBrowse, iximeiCrmCustomerRemark, iximeiCrmCustomerStatus, iximeiCrmDispatch, iximeiCrmDispatchFollowLog, iximeiCrmDispatchReply, iximeiCrmDispatchStatus, iximeiCrmHospital, iximeiCrmHospitalAccount, iximeiCrmMemberBrowse, iximeiCrmMemberCustomer, iximeiCrmMemberRemark, sysApiToken, sysApp, sysAppMenu, sysAppResource, sysAttachment, sysAttachmentFolder, sysDept, sysDictData, sysDictType, sysFormData, sysFormField, sysLoginLog, sysMenu, sysMenuPermission, sysOption, sysPlugin, sysPluginConfigSnapshot, sysPluginInstall, sysPluginSyncLog, sysPluginVersion, sysPost, sysRole, sysRoleMenu, sysRolePermission, sysUser, sysUserDept, sysUserRole, sysUserToken } from './tables'

export const sysAppRelations = relations(sysApp, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysApp.creatorId], references: [sysUser.id], relationName: 'sysApp_creatorId' }),
  updater: one(sysUser, { fields: [sysApp.updaterId], references: [sysUser.id], relationName: 'sysApp_updaterId' }),
  sysAppResource_app_id: many(sysAppResource, { relationName: 'sysAppResource_appId' }),
  sysAppMenu_app_id: many(sysAppMenu, { relationName: 'sysAppMenu_appId' })
}))

export const sysAppResourceRelations = relations(sysAppResource, ({ one, many }) => ({
  appId: one(sysApp, { fields: [sysAppResource.appId], references: [sysApp.id], relationName: 'sysAppResource_appId' }),
  parent: one(sysAppResource, { fields: [sysAppResource.parentId], references: [sysAppResource.id], relationName: 'sysAppResource_parentId' }),
  creator: one(sysUser, { fields: [sysAppResource.creatorId], references: [sysUser.id], relationName: 'sysAppResource_creatorId' }),
  updater: one(sysUser, { fields: [sysAppResource.updaterId], references: [sysUser.id], relationName: 'sysAppResource_updaterId' }),
  children: many(sysAppResource, { relationName: 'sysAppResource_parentId' }),
  sysFormField_resource_id: many(sysFormField, { relationName: 'sysFormField_resourceId' }),
  sysFormData_resource_id: many(sysFormData, { relationName: 'sysFormData_resourceId' }),
  sysAppMenu_resource_id: many(sysAppMenu, { relationName: 'sysAppMenu_resourceId' })
}))

export const sysFormFieldRelations = relations(sysFormField, ({ one, many }) => ({
  resourceId: one(sysAppResource, { fields: [sysFormField.resourceId], references: [sysAppResource.id], relationName: 'sysFormField_resourceId' }),
  creator: one(sysUser, { fields: [sysFormField.creatorId], references: [sysUser.id], relationName: 'sysFormField_creatorId' }),
  updater: one(sysUser, { fields: [sysFormField.updaterId], references: [sysUser.id], relationName: 'sysFormField_updaterId' })
}))

export const sysFormDataRelations = relations(sysFormData, ({ one, many }) => ({
  resourceId: one(sysAppResource, { fields: [sysFormData.resourceId], references: [sysAppResource.id], relationName: 'sysFormData_resourceId' }),
  creator: one(sysUser, { fields: [sysFormData.creatorId], references: [sysUser.id], relationName: 'sysFormData_creatorId' }),
  updater: one(sysUser, { fields: [sysFormData.updaterId], references: [sysUser.id], relationName: 'sysFormData_updaterId' })
}))

export const sysAppMenuRelations = relations(sysAppMenu, ({ one, many }) => ({
  appId: one(sysApp, { fields: [sysAppMenu.appId], references: [sysApp.id], relationName: 'sysAppMenu_appId' }),
  parent: one(sysAppMenu, { fields: [sysAppMenu.parentId], references: [sysAppMenu.id], relationName: 'sysAppMenu_parentId' }),
  resourceId: one(sysAppResource, { fields: [sysAppMenu.resourceId], references: [sysAppResource.id], relationName: 'sysAppMenu_resourceId' }),
  creator: one(sysUser, { fields: [sysAppMenu.creatorId], references: [sysUser.id], relationName: 'sysAppMenu_creatorId' }),
  updater: one(sysUser, { fields: [sysAppMenu.updaterId], references: [sysUser.id], relationName: 'sysAppMenu_updaterId' }),
  children: many(sysAppMenu, { relationName: 'sysAppMenu_parentId' })
}))

export const sysOptionRelations = relations(sysOption, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysOption.creatorId], references: [sysUser.id], relationName: 'sysOption_creatorId' }),
  updater: one(sysUser, { fields: [sysOption.updaterId], references: [sysUser.id], relationName: 'sysOption_updaterId' })
}))

export const sysUserRelations = relations(sysUser, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysUser.creatorId], references: [sysUser.id], relationName: 'sysUser_creatorId' }),
  updater: one(sysUser, { fields: [sysUser.updaterId], references: [sysUser.id], relationName: 'sysUser_updaterId' }),
  sysApp_creator_id: many(sysApp, { relationName: 'sysApp_creatorId' }),
  sysApp_updater_id: many(sysApp, { relationName: 'sysApp_updaterId' }),
  sysAppResource_creator_id: many(sysAppResource, { relationName: 'sysAppResource_creatorId' }),
  sysAppResource_updater_id: many(sysAppResource, { relationName: 'sysAppResource_updaterId' }),
  sysFormField_creator_id: many(sysFormField, { relationName: 'sysFormField_creatorId' }),
  sysFormField_updater_id: many(sysFormField, { relationName: 'sysFormField_updaterId' }),
  sysFormData_creator_id: many(sysFormData, { relationName: 'sysFormData_creatorId' }),
  sysFormData_updater_id: many(sysFormData, { relationName: 'sysFormData_updaterId' }),
  sysAppMenu_creator_id: many(sysAppMenu, { relationName: 'sysAppMenu_creatorId' }),
  sysAppMenu_updater_id: many(sysAppMenu, { relationName: 'sysAppMenu_updaterId' }),
  sysOption_creator_id: many(sysOption, { relationName: 'sysOption_creatorId' }),
  sysOption_updater_id: many(sysOption, { relationName: 'sysOption_updaterId' }),
  sysUser_creator_id: many(sysUser, { relationName: 'sysUser_creatorId' }),
  sysUser_updater_id: many(sysUser, { relationName: 'sysUser_updaterId' }),
  sysUserToken_user_id: many(sysUserToken, { relationName: 'sysUserToken_userId' }),
  sysLoginLog_user_id: many(sysLoginLog, { relationName: 'sysLoginLog_userId' }),
  sysRole_creator_id: many(sysRole, { relationName: 'sysRole_creatorId' }),
  sysRole_updater_id: many(sysRole, { relationName: 'sysRole_updaterId' }),
  sysUserRole_user_id: many(sysUserRole, { relationName: 'sysUserRole_userId' }),
  sysUserDept_user_id: many(sysUserDept, { relationName: 'sysUserDept_userId' }),
  sysDept_leader_id: many(sysDept, { relationName: 'sysDept_leaderId' }),
  sysDept_creator_id: many(sysDept, { relationName: 'sysDept_creatorId' }),
  sysDept_updater_id: many(sysDept, { relationName: 'sysDept_updaterId' }),
  sysPost_creator_id: many(sysPost, { relationName: 'sysPost_creatorId' }),
  sysPost_updater_id: many(sysPost, { relationName: 'sysPost_updaterId' }),
  sysMenu_creator_id: many(sysMenu, { relationName: 'sysMenu_creatorId' }),
  sysMenu_updater_id: many(sysMenu, { relationName: 'sysMenu_updaterId' }),
  sysRolePermission_creator_id: many(sysRolePermission, { relationName: 'sysRolePermission_creatorId' }),
  sysDictType_creator_id: many(sysDictType, { relationName: 'sysDictType_creatorId' }),
  sysDictType_updater_id: many(sysDictType, { relationName: 'sysDictType_updaterId' }),
  sysDictData_creator_id: many(sysDictData, { relationName: 'sysDictData_creatorId' }),
  sysDictData_updater_id: many(sysDictData, { relationName: 'sysDictData_updaterId' }),
  sysAttachmentFolder_creator_id: many(sysAttachmentFolder, { relationName: 'sysAttachmentFolder_creatorId' }),
  sysAttachmentFolder_updater_id: many(sysAttachmentFolder, { relationName: 'sysAttachmentFolder_updaterId' }),
  sysAttachment_creator_id: many(sysAttachment, { relationName: 'sysAttachment_creatorId' }),
  sysAttachment_updater_id: many(sysAttachment, { relationName: 'sysAttachment_updaterId' }),
  sysApiToken_user_id: many(sysApiToken, { relationName: 'sysApiToken_userId' }),
  iximeiCrmHospital_creator_id: many(iximeiCrmHospital, { relationName: 'iximeiCrmHospital_creatorId' }),
  iximeiCrmHospital_updater_id: many(iximeiCrmHospital, { relationName: 'iximeiCrmHospital_updaterId' }),
  iximeiCrmCustomer_owner_user_id: many(iximeiCrmCustomer, { relationName: 'iximeiCrmCustomer_ownerUserId' }),
  iximeiCrmCustomer_creator_id: many(iximeiCrmCustomer, { relationName: 'iximeiCrmCustomer_creatorId' }),
  iximeiCrmCustomer_updater_id: many(iximeiCrmCustomer, { relationName: 'iximeiCrmCustomer_updaterId' }),
  iximeiCrmCustomerRemark_user_id: many(iximeiCrmCustomerRemark, { relationName: 'iximeiCrmCustomerRemark_userId' }),
  iximeiCrmCustomerBrowse_user_id: many(iximeiCrmCustomerBrowse, { relationName: 'iximeiCrmCustomerBrowse_userId' }),
  iximeiCrmDispatch_creator_id: many(iximeiCrmDispatch, { relationName: 'iximeiCrmDispatch_creatorId' }),
  iximeiCrmDispatch_updater_id: many(iximeiCrmDispatch, { relationName: 'iximeiCrmDispatch_updaterId' }),
  iximeiCrmDispatchReply_user_id: many(iximeiCrmDispatchReply, { relationName: 'iximeiCrmDispatchReply_userId' }),
  iximeiCrmDispatchFollowLog_user_id: many(iximeiCrmDispatchFollowLog, { relationName: 'iximeiCrmDispatchFollowLog_userId' }),
  iximeiCrmMemberCustomer_owner_user_id: many(iximeiCrmMemberCustomer, { relationName: 'iximeiCrmMemberCustomer_ownerUserId' }),
  iximeiCrmMemberCustomer_creator_id: many(iximeiCrmMemberCustomer, { relationName: 'iximeiCrmMemberCustomer_creatorId' }),
  iximeiCrmMemberCustomer_updater_id: many(iximeiCrmMemberCustomer, { relationName: 'iximeiCrmMemberCustomer_updaterId' }),
  iximeiCrmMemberRemark_user_id: many(iximeiCrmMemberRemark, { relationName: 'iximeiCrmMemberRemark_userId' }),
  iximeiCrmMemberBrowse_user_id: many(iximeiCrmMemberBrowse, { relationName: 'iximeiCrmMemberBrowse_userId' }),
  iximeiCrmHospitalAccount_user_id: many(iximeiCrmHospitalAccount, { relationName: 'iximeiCrmHospitalAccount_userId' }),
  iximeiCrmHospitalAccount_creator_id: many(iximeiCrmHospitalAccount, { relationName: 'iximeiCrmHospitalAccount_creatorId' }),
  iximeiCrmHospitalAccount_updater_id: many(iximeiCrmHospitalAccount, { relationName: 'iximeiCrmHospitalAccount_updaterId' })
}))

export const sysUserTokenRelations = relations(sysUserToken, ({ one, many }) => ({
  userId: one(sysUser, { fields: [sysUserToken.userId], references: [sysUser.id], relationName: 'sysUserToken_userId' })
}))

export const sysLoginLogRelations = relations(sysLoginLog, ({ one, many }) => ({
  userId: one(sysUser, { fields: [sysLoginLog.userId], references: [sysUser.id], relationName: 'sysLoginLog_userId' })
}))

export const sysRoleRelations = relations(sysRole, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysRole.creatorId], references: [sysUser.id], relationName: 'sysRole_creatorId' }),
  updater: one(sysUser, { fields: [sysRole.updaterId], references: [sysUser.id], relationName: 'sysRole_updaterId' }),
  sysUserRole_role_id: many(sysUserRole, { relationName: 'sysUserRole_roleId' }),
  sysRoleMenu_role_id: many(sysRoleMenu, { relationName: 'sysRoleMenu_roleId' }),
  sysRolePermission_role_id: many(sysRolePermission, { relationName: 'sysRolePermission_roleId' })
}))

export const sysUserRoleRelations = relations(sysUserRole, ({ one, many }) => ({
  userId: one(sysUser, { fields: [sysUserRole.userId], references: [sysUser.id], relationName: 'sysUserRole_userId' }),
  roleId: one(sysRole, { fields: [sysUserRole.roleId], references: [sysRole.id], relationName: 'sysUserRole_roleId' })
}))

export const sysUserDeptRelations = relations(sysUserDept, ({ one, many }) => ({
  userId: one(sysUser, { fields: [sysUserDept.userId], references: [sysUser.id], relationName: 'sysUserDept_userId' }),
  deptId: one(sysDept, { fields: [sysUserDept.deptId], references: [sysDept.id], relationName: 'sysUserDept_deptId' })
}))

export const sysDeptRelations = relations(sysDept, ({ one, many }) => ({
  parent: one(sysDept, { fields: [sysDept.parentId], references: [sysDept.id], relationName: 'sysDept_parentId' }),
  leader: one(sysUser, { fields: [sysDept.leaderId], references: [sysUser.id], relationName: 'sysDept_leaderId' }),
  creator: one(sysUser, { fields: [sysDept.creatorId], references: [sysUser.id], relationName: 'sysDept_creatorId' }),
  updater: one(sysUser, { fields: [sysDept.updaterId], references: [sysUser.id], relationName: 'sysDept_updaterId' }),
  sysUserDept_dept_id: many(sysUserDept, { relationName: 'sysUserDept_deptId' }),
  children: many(sysDept, { relationName: 'sysDept_parentId' })
}))

export const sysPostRelations = relations(sysPost, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysPost.creatorId], references: [sysUser.id], relationName: 'sysPost_creatorId' }),
  updater: one(sysUser, { fields: [sysPost.updaterId], references: [sysUser.id], relationName: 'sysPost_updaterId' })
}))

export const sysMenuRelations = relations(sysMenu, ({ one, many }) => ({
  parent: one(sysMenu, { fields: [sysMenu.parentId], references: [sysMenu.id], relationName: 'sysMenu_parentId' }),
  creator: one(sysUser, { fields: [sysMenu.creatorId], references: [sysUser.id], relationName: 'sysMenu_creatorId' }),
  updater: one(sysUser, { fields: [sysMenu.updaterId], references: [sysUser.id], relationName: 'sysMenu_updaterId' }),
  children: many(sysMenu, { relationName: 'sysMenu_parentId' }),
  sysMenuPermission_menu_id: many(sysMenuPermission, { relationName: 'sysMenuPermission_menuId' }),
  sysRoleMenu_menu_id: many(sysRoleMenu, { relationName: 'sysRoleMenu_menuId' })
}))

export const sysMenuPermissionRelations = relations(sysMenuPermission, ({ one, many }) => ({
  menuId: one(sysMenu, { fields: [sysMenuPermission.menuId], references: [sysMenu.id], relationName: 'sysMenuPermission_menuId' })
}))

export const sysRoleMenuRelations = relations(sysRoleMenu, ({ one, many }) => ({
  roleId: one(sysRole, { fields: [sysRoleMenu.roleId], references: [sysRole.id], relationName: 'sysRoleMenu_roleId' }),
  menuId: one(sysMenu, { fields: [sysRoleMenu.menuId], references: [sysMenu.id], relationName: 'sysRoleMenu_menuId' })
}))

export const sysRolePermissionRelations = relations(sysRolePermission, ({ one, many }) => ({
  roleId: one(sysRole, { fields: [sysRolePermission.roleId], references: [sysRole.id], relationName: 'sysRolePermission_roleId' }),
  creator: one(sysUser, { fields: [sysRolePermission.creatorId], references: [sysUser.id], relationName: 'sysRolePermission_creatorId' })
}))

export const sysDictTypeRelations = relations(sysDictType, ({ one, many }) => ({
  creator: one(sysUser, { fields: [sysDictType.creatorId], references: [sysUser.id], relationName: 'sysDictType_creatorId' }),
  updater: one(sysUser, { fields: [sysDictType.updaterId], references: [sysUser.id], relationName: 'sysDictType_updaterId' }),
  sysDictData_type_id: many(sysDictData, { relationName: 'sysDictData_typeId' })
}))

export const sysDictDataRelations = relations(sysDictData, ({ one, many }) => ({
  typeId: one(sysDictType, { fields: [sysDictData.typeId], references: [sysDictType.id], relationName: 'sysDictData_typeId' }),
  creator: one(sysUser, { fields: [sysDictData.creatorId], references: [sysUser.id], relationName: 'sysDictData_creatorId' }),
  updater: one(sysUser, { fields: [sysDictData.updaterId], references: [sysUser.id], relationName: 'sysDictData_updaterId' })
}))

export const sysAttachmentFolderRelations = relations(sysAttachmentFolder, ({ one, many }) => ({
  parent: one(sysAttachmentFolder, { fields: [sysAttachmentFolder.parentId], references: [sysAttachmentFolder.id], relationName: 'sysAttachmentFolder_parentId' }),
  creator: one(sysUser, { fields: [sysAttachmentFolder.creatorId], references: [sysUser.id], relationName: 'sysAttachmentFolder_creatorId' }),
  updater: one(sysUser, { fields: [sysAttachmentFolder.updaterId], references: [sysUser.id], relationName: 'sysAttachmentFolder_updaterId' }),
  children: many(sysAttachmentFolder, { relationName: 'sysAttachmentFolder_parentId' }),
  sysAttachment_folder_id: many(sysAttachment, { relationName: 'sysAttachment_folderId' })
}))

export const sysAttachmentRelations = relations(sysAttachment, ({ one, many }) => ({
  folderId: one(sysAttachmentFolder, { fields: [sysAttachment.folderId], references: [sysAttachmentFolder.id], relationName: 'sysAttachment_folderId' }),
  creator: one(sysUser, { fields: [sysAttachment.creatorId], references: [sysUser.id], relationName: 'sysAttachment_creatorId' }),
  updater: one(sysUser, { fields: [sysAttachment.updaterId], references: [sysUser.id], relationName: 'sysAttachment_updaterId' })
}))

export const sysPluginRelations = relations(sysPlugin, ({ one, many }) => ({
  pluginId: one(sysPlugin, { fields: [sysPlugin.pluginId], references: [sysPlugin.id], relationName: 'sysPlugin_pluginId' }),
  sysPlugin_plugin_id: many(sysPlugin, { relationName: 'sysPlugin_pluginId' }),
  sysPluginVersion_plugin_id: many(sysPluginVersion, { relationName: 'sysPluginVersion_pluginId' }),
  sysPluginInstall_plugin_id: many(sysPluginInstall, { relationName: 'sysPluginInstall_pluginId' }),
  sysPluginConfigSnapshot_plugin_id: many(sysPluginConfigSnapshot, { relationName: 'sysPluginConfigSnapshot_pluginId' })
}))

export const sysPluginVersionRelations = relations(sysPluginVersion, ({ one, many }) => ({
  pluginId: one(sysPlugin, { fields: [sysPluginVersion.pluginId], references: [sysPlugin.id], relationName: 'sysPluginVersion_pluginId' })
}))

export const sysPluginInstallRelations = relations(sysPluginInstall, ({ one, many }) => ({
  pluginId: one(sysPlugin, { fields: [sysPluginInstall.pluginId], references: [sysPlugin.id], relationName: 'sysPluginInstall_pluginId' }),
  sysPluginSyncLog_plugin_install_id: many(sysPluginSyncLog, { relationName: 'sysPluginSyncLog_pluginInstallId' })
}))

export const sysPluginConfigSnapshotRelations = relations(sysPluginConfigSnapshot, ({ one, many }) => ({
  pluginId: one(sysPlugin, { fields: [sysPluginConfigSnapshot.pluginId], references: [sysPlugin.id], relationName: 'sysPluginConfigSnapshot_pluginId' })
}))

export const sysPluginSyncLogRelations = relations(sysPluginSyncLog, ({ one, many }) => ({
  pluginInstallId: one(sysPluginInstall, { fields: [sysPluginSyncLog.pluginInstallId], references: [sysPluginInstall.id], relationName: 'sysPluginSyncLog_pluginInstallId' })
}))

export const sysApiTokenRelations = relations(sysApiToken, ({ one, many }) => ({
  userId: one(sysUser, { fields: [sysApiToken.userId], references: [sysUser.id], relationName: 'sysApiToken_userId' })
}))

export const iximeiCrmHospitalRelations = relations(iximeiCrmHospital, ({ one, many }) => ({
  creator: one(sysUser, { fields: [iximeiCrmHospital.creatorId], references: [sysUser.id], relationName: 'iximeiCrmHospital_creatorId' }),
  updater: one(sysUser, { fields: [iximeiCrmHospital.updaterId], references: [sysUser.id], relationName: 'iximeiCrmHospital_updaterId' }),
  iximeiCrmDispatch_hospital_id: many(iximeiCrmDispatch, { relationName: 'iximeiCrmDispatch_hospitalId' }),
  iximeiCrmHospitalAccount_hospital_id: many(iximeiCrmHospitalAccount, { relationName: 'iximeiCrmHospitalAccount_hospitalId' })
}))

export const iximeiCrmCustomerRelations = relations(iximeiCrmCustomer, ({ one, many }) => ({
  status: one(iximeiCrmCustomerStatus, { fields: [iximeiCrmCustomer.statusId], references: [iximeiCrmCustomerStatus.id], relationName: 'iximeiCrmCustomer_statusId' }),
  owner: one(sysUser, { fields: [iximeiCrmCustomer.ownerUserId], references: [sysUser.id], relationName: 'iximeiCrmCustomer_ownerUserId' }),
  creator: one(sysUser, { fields: [iximeiCrmCustomer.creatorId], references: [sysUser.id], relationName: 'iximeiCrmCustomer_creatorId' }),
  updater: one(sysUser, { fields: [iximeiCrmCustomer.updaterId], references: [sysUser.id], relationName: 'iximeiCrmCustomer_updaterId' }),
  iximeiCrmCustomerRemark_customer_id: many(iximeiCrmCustomerRemark, { relationName: 'iximeiCrmCustomerRemark_customerId' }),
  iximeiCrmCustomerBrowse_customer_id: many(iximeiCrmCustomerBrowse, { relationName: 'iximeiCrmCustomerBrowse_customerId' }),
  iximeiCrmDispatch_customer_id: many(iximeiCrmDispatch, { relationName: 'iximeiCrmDispatch_customerId' })
}))

export const iximeiCrmCustomerRemarkRelations = relations(iximeiCrmCustomerRemark, ({ one, many }) => ({
  customer: one(iximeiCrmCustomer, { fields: [iximeiCrmCustomerRemark.customerId], references: [iximeiCrmCustomer.id], relationName: 'iximeiCrmCustomerRemark_customerId' }),
  user: one(sysUser, { fields: [iximeiCrmCustomerRemark.userId], references: [sysUser.id], relationName: 'iximeiCrmCustomerRemark_userId' })
}))

export const iximeiCrmCustomerBrowseRelations = relations(iximeiCrmCustomerBrowse, ({ one, many }) => ({
  customer: one(iximeiCrmCustomer, { fields: [iximeiCrmCustomerBrowse.customerId], references: [iximeiCrmCustomer.id], relationName: 'iximeiCrmCustomerBrowse_customerId' }),
  user: one(sysUser, { fields: [iximeiCrmCustomerBrowse.userId], references: [sysUser.id], relationName: 'iximeiCrmCustomerBrowse_userId' })
}))

export const iximeiCrmDispatchRelations = relations(iximeiCrmDispatch, ({ one, many }) => ({
  customer: one(iximeiCrmCustomer, { fields: [iximeiCrmDispatch.customerId], references: [iximeiCrmCustomer.id], relationName: 'iximeiCrmDispatch_customerId' }),
  hospital: one(iximeiCrmHospital, { fields: [iximeiCrmDispatch.hospitalId], references: [iximeiCrmHospital.id], relationName: 'iximeiCrmDispatch_hospitalId' }),
  status: one(iximeiCrmDispatchStatus, { fields: [iximeiCrmDispatch.statusId], references: [iximeiCrmDispatchStatus.id], relationName: 'iximeiCrmDispatch_statusId' }),
  creator: one(sysUser, { fields: [iximeiCrmDispatch.creatorId], references: [sysUser.id], relationName: 'iximeiCrmDispatch_creatorId' }),
  updater: one(sysUser, { fields: [iximeiCrmDispatch.updaterId], references: [sysUser.id], relationName: 'iximeiCrmDispatch_updaterId' }),
  iximeiCrmDispatchReply_dispatch_id: many(iximeiCrmDispatchReply, { relationName: 'iximeiCrmDispatchReply_dispatchId' }),
  iximeiCrmDispatchFollowLog_dispatch_id: many(iximeiCrmDispatchFollowLog, { relationName: 'iximeiCrmDispatchFollowLog_dispatchId' })
}))

export const iximeiCrmDispatchReplyRelations = relations(iximeiCrmDispatchReply, ({ one, many }) => ({
  dispatch: one(iximeiCrmDispatch, { fields: [iximeiCrmDispatchReply.dispatchId], references: [iximeiCrmDispatch.id], relationName: 'iximeiCrmDispatchReply_dispatchId' }),
  user: one(sysUser, { fields: [iximeiCrmDispatchReply.userId], references: [sysUser.id], relationName: 'iximeiCrmDispatchReply_userId' })
}))

export const iximeiCrmDispatchFollowLogRelations = relations(iximeiCrmDispatchFollowLog, ({ one, many }) => ({
  dispatch: one(iximeiCrmDispatch, { fields: [iximeiCrmDispatchFollowLog.dispatchId], references: [iximeiCrmDispatch.id], relationName: 'iximeiCrmDispatchFollowLog_dispatchId' }),
  user: one(sysUser, { fields: [iximeiCrmDispatchFollowLog.userId], references: [sysUser.id], relationName: 'iximeiCrmDispatchFollowLog_userId' })
}))

export const iximeiCrmMemberCustomerRelations = relations(iximeiCrmMemberCustomer, ({ one, many }) => ({
  owner: one(sysUser, { fields: [iximeiCrmMemberCustomer.ownerUserId], references: [sysUser.id], relationName: 'iximeiCrmMemberCustomer_ownerUserId' }),
  creator: one(sysUser, { fields: [iximeiCrmMemberCustomer.creatorId], references: [sysUser.id], relationName: 'iximeiCrmMemberCustomer_creatorId' }),
  updater: one(sysUser, { fields: [iximeiCrmMemberCustomer.updaterId], references: [sysUser.id], relationName: 'iximeiCrmMemberCustomer_updaterId' }),
  iximeiCrmMemberRemark_member_id: many(iximeiCrmMemberRemark, { relationName: 'iximeiCrmMemberRemark_memberId' }),
  iximeiCrmMemberBrowse_member_id: many(iximeiCrmMemberBrowse, { relationName: 'iximeiCrmMemberBrowse_memberId' })
}))

export const iximeiCrmMemberRemarkRelations = relations(iximeiCrmMemberRemark, ({ one, many }) => ({
  member: one(iximeiCrmMemberCustomer, { fields: [iximeiCrmMemberRemark.memberId], references: [iximeiCrmMemberCustomer.id], relationName: 'iximeiCrmMemberRemark_memberId' }),
  user: one(sysUser, { fields: [iximeiCrmMemberRemark.userId], references: [sysUser.id], relationName: 'iximeiCrmMemberRemark_userId' })
}))

export const iximeiCrmMemberBrowseRelations = relations(iximeiCrmMemberBrowse, ({ one, many }) => ({
  member: one(iximeiCrmMemberCustomer, { fields: [iximeiCrmMemberBrowse.memberId], references: [iximeiCrmMemberCustomer.id], relationName: 'iximeiCrmMemberBrowse_memberId' }),
  user: one(sysUser, { fields: [iximeiCrmMemberBrowse.userId], references: [sysUser.id], relationName: 'iximeiCrmMemberBrowse_userId' })
}))

export const iximeiCrmHospitalAccountRelations = relations(iximeiCrmHospitalAccount, ({ one, many }) => ({
  hospital: one(iximeiCrmHospital, { fields: [iximeiCrmHospitalAccount.hospitalId], references: [iximeiCrmHospital.id], relationName: 'iximeiCrmHospitalAccount_hospitalId' }),
  user: one(sysUser, { fields: [iximeiCrmHospitalAccount.userId], references: [sysUser.id], relationName: 'iximeiCrmHospitalAccount_userId' }),
  creator: one(sysUser, { fields: [iximeiCrmHospitalAccount.creatorId], references: [sysUser.id], relationName: 'iximeiCrmHospitalAccount_creatorId' }),
  updater: one(sysUser, { fields: [iximeiCrmHospitalAccount.updaterId], references: [sysUser.id], relationName: 'iximeiCrmHospitalAccount_updaterId' })
}))

export const iximeiCrmCustomerStatusRelations = relations(iximeiCrmCustomerStatus, ({ one, many }) => ({
  iximeiCrmCustomer_status_id: many(iximeiCrmCustomer, { relationName: 'iximeiCrmCustomer_statusId' })
}))

export const iximeiCrmDispatchStatusRelations = relations(iximeiCrmDispatchStatus, ({ one, many }) => ({
  iximeiCrmDispatch_status_id: many(iximeiCrmDispatch, { relationName: 'iximeiCrmDispatch_statusId' })
}))

