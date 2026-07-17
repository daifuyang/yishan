// Generated from drizzle/*.sql. Do not edit manually.
import { relations } from 'drizzle-orm'
import { portalArticle, portalArticleCategory, portalCategory, portalPage, portalTemplate, shopAddress, shopAttribute, shopAttributeValue, shopCart, shopCategory, shopOrder, shopOrderItem, shopProduct, shopSku, shopSkuAttribute, sysApiToken, sysApp, sysAppMenu, sysAppResource, sysAttachment, sysAttachmentFolder, sysDept, sysDictData, sysDictType, sysFormData, sysFormField, sysLoginLog, sysMenu, sysOption, sysPlugin, sysPluginConfigSnapshot, sysPluginInstall, sysPluginSyncLog, sysPluginVersion, sysPost, sysRole, sysRoleMenu, sysUser, sysUserDept, sysUserRole, sysUserToken } from './tables'

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
  sysDictType_creator_id: many(sysDictType, { relationName: 'sysDictType_creatorId' }),
  sysDictType_updater_id: many(sysDictType, { relationName: 'sysDictType_updaterId' }),
  sysDictData_creator_id: many(sysDictData, { relationName: 'sysDictData_creatorId' }),
  sysDictData_updater_id: many(sysDictData, { relationName: 'sysDictData_updaterId' }),
  sysAttachmentFolder_creator_id: many(sysAttachmentFolder, { relationName: 'sysAttachmentFolder_creatorId' }),
  sysAttachmentFolder_updater_id: many(sysAttachmentFolder, { relationName: 'sysAttachmentFolder_updaterId' }),
  sysAttachment_creator_id: many(sysAttachment, { relationName: 'sysAttachment_creatorId' }),
  sysAttachment_updater_id: many(sysAttachment, { relationName: 'sysAttachment_updaterId' }),
  sysApiToken_user_id: many(sysApiToken, { relationName: 'sysApiToken_userId' }),
  portalCategory_creator_id: many(portalCategory, { relationName: 'portalCategory_creatorId' }),
  portalCategory_updater_id: many(portalCategory, { relationName: 'portalCategory_updaterId' }),
  portalArticle_creator_id: many(portalArticle, { relationName: 'portalArticle_creatorId' }),
  portalArticle_updater_id: many(portalArticle, { relationName: 'portalArticle_updaterId' }),
  portalPage_creator_id: many(portalPage, { relationName: 'portalPage_creatorId' }),
  portalPage_updater_id: many(portalPage, { relationName: 'portalPage_updaterId' }),
  portalTemplate_creator_id: many(portalTemplate, { relationName: 'portalTemplate_creatorId' }),
  portalTemplate_updater_id: many(portalTemplate, { relationName: 'portalTemplate_updaterId' }),
  shopCategory_creator_id: many(shopCategory, { relationName: 'shopCategory_creatorId' }),
  shopCategory_updater_id: many(shopCategory, { relationName: 'shopCategory_updaterId' }),
  shopAttribute_creator_id: many(shopAttribute, { relationName: 'shopAttribute_creatorId' }),
  shopAttribute_updater_id: many(shopAttribute, { relationName: 'shopAttribute_updaterId' }),
  shopAttributeValue_creator_id: many(shopAttributeValue, { relationName: 'shopAttributeValue_creatorId' }),
  shopAttributeValue_updater_id: many(shopAttributeValue, { relationName: 'shopAttributeValue_updaterId' }),
  shopProduct_creator_id: many(shopProduct, { relationName: 'shopProduct_creatorId' }),
  shopProduct_updater_id: many(shopProduct, { relationName: 'shopProduct_updaterId' }),
  shopSku_creator_id: many(shopSku, { relationName: 'shopSku_creatorId' }),
  shopSku_updater_id: many(shopSku, { relationName: 'shopSku_updaterId' }),
  shopAddress_user_id: many(shopAddress, { relationName: 'shopAddress_userId' }),
  shopAddress_creator_id: many(shopAddress, { relationName: 'shopAddress_creatorId' }),
  shopAddress_updater_id: many(shopAddress, { relationName: 'shopAddress_updaterId' }),
  shopCart_user_id: many(shopCart, { relationName: 'shopCart_userId' }),
  shopCart_creator_id: many(shopCart, { relationName: 'shopCart_creatorId' }),
  shopCart_updater_id: many(shopCart, { relationName: 'shopCart_updaterId' }),
  shopOrder_user_id: many(shopOrder, { relationName: 'shopOrder_userId' }),
  shopOrder_creator_id: many(shopOrder, { relationName: 'shopOrder_creatorId' }),
  shopOrder_updater_id: many(shopOrder, { relationName: 'shopOrder_updaterId' }),
  shopOrderItem_creator_id: many(shopOrderItem, { relationName: 'shopOrderItem_creatorId' }),
  shopOrderItem_updater_id: many(shopOrderItem, { relationName: 'shopOrderItem_updaterId' })
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
  sysRoleMenu_role_id: many(sysRoleMenu, { relationName: 'sysRoleMenu_roleId' })
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
  sysRoleMenu_menu_id: many(sysRoleMenu, { relationName: 'sysRoleMenu_menuId' })
}))

export const sysRoleMenuRelations = relations(sysRoleMenu, ({ one, many }) => ({
  roleId: one(sysRole, { fields: [sysRoleMenu.roleId], references: [sysRole.id], relationName: 'sysRoleMenu_roleId' }),
  menuId: one(sysMenu, { fields: [sysRoleMenu.menuId], references: [sysMenu.id], relationName: 'sysRoleMenu_menuId' })
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

export const portalCategoryRelations = relations(portalCategory, ({ one, many }) => ({
  parent: one(portalCategory, { fields: [portalCategory.parentId], references: [portalCategory.id], relationName: 'portalCategory_parentId' }),
  creator: one(sysUser, { fields: [portalCategory.creatorId], references: [sysUser.id], relationName: 'portalCategory_creatorId' }),
  updater: one(sysUser, { fields: [portalCategory.updaterId], references: [sysUser.id], relationName: 'portalCategory_updaterId' }),
  children: many(portalCategory, { relationName: 'portalCategory_parentId' }),
  portalArticleCategory_category_id: many(portalArticleCategory, { relationName: 'portalArticleCategory_categoryId' })
}))

export const portalArticleRelations = relations(portalArticle, ({ one, many }) => ({
  template: one(portalTemplate, { fields: [portalArticle.templateId], references: [portalTemplate.id], relationName: 'portalArticle_templateId' }),
  creator: one(sysUser, { fields: [portalArticle.creatorId], references: [sysUser.id], relationName: 'portalArticle_creatorId' }),
  updater: one(sysUser, { fields: [portalArticle.updaterId], references: [sysUser.id], relationName: 'portalArticle_updaterId' }),
  portalArticleCategory_article_id: many(portalArticleCategory, { relationName: 'portalArticleCategory_articleId' })
}))

export const portalArticleCategoryRelations = relations(portalArticleCategory, ({ one, many }) => ({
  article: one(portalArticle, { fields: [portalArticleCategory.articleId], references: [portalArticle.id], relationName: 'portalArticleCategory_articleId' }),
  category: one(portalCategory, { fields: [portalArticleCategory.categoryId], references: [portalCategory.id], relationName: 'portalArticleCategory_categoryId' })
}))

export const portalPageRelations = relations(portalPage, ({ one, many }) => ({
  template: one(portalTemplate, { fields: [portalPage.templateId], references: [portalTemplate.id], relationName: 'portalPage_templateId' }),
  creator: one(sysUser, { fields: [portalPage.creatorId], references: [sysUser.id], relationName: 'portalPage_creatorId' }),
  updater: one(sysUser, { fields: [portalPage.updaterId], references: [sysUser.id], relationName: 'portalPage_updaterId' })
}))

export const portalTemplateRelations = relations(portalTemplate, ({ one, many }) => ({
  creator: one(sysUser, { fields: [portalTemplate.creatorId], references: [sysUser.id], relationName: 'portalTemplate_creatorId' }),
  updater: one(sysUser, { fields: [portalTemplate.updaterId], references: [sysUser.id], relationName: 'portalTemplate_updaterId' }),
  portalArticle_template_id: many(portalArticle, { relationName: 'portalArticle_templateId' }),
  portalPage_template_id: many(portalPage, { relationName: 'portalPage_templateId' })
}))

export const shopCategoryRelations = relations(shopCategory, ({ one, many }) => ({
  parent: one(shopCategory, { fields: [shopCategory.parentId], references: [shopCategory.id], relationName: 'shopCategory_parentId' }),
  creator: one(sysUser, { fields: [shopCategory.creatorId], references: [sysUser.id], relationName: 'shopCategory_creatorId' }),
  updater: one(sysUser, { fields: [shopCategory.updaterId], references: [sysUser.id], relationName: 'shopCategory_updaterId' }),
  children: many(shopCategory, { relationName: 'shopCategory_parentId' }),
  shopProduct_category_id: many(shopProduct, { relationName: 'shopProduct_categoryId' })
}))

export const shopAttributeRelations = relations(shopAttribute, ({ one, many }) => ({
  creator: one(sysUser, { fields: [shopAttribute.creatorId], references: [sysUser.id], relationName: 'shopAttribute_creatorId' }),
  updater: one(sysUser, { fields: [shopAttribute.updaterId], references: [sysUser.id], relationName: 'shopAttribute_updaterId' }),
  shopAttributeValue_attribute_id: many(shopAttributeValue, { relationName: 'shopAttributeValue_attributeId' }),
  shopSkuAttribute_attribute_id: many(shopSkuAttribute, { relationName: 'shopSkuAttribute_attributeId' })
}))

export const shopAttributeValueRelations = relations(shopAttributeValue, ({ one, many }) => ({
  attribute: one(shopAttribute, { fields: [shopAttributeValue.attributeId], references: [shopAttribute.id], relationName: 'shopAttributeValue_attributeId' }),
  creator: one(sysUser, { fields: [shopAttributeValue.creatorId], references: [sysUser.id], relationName: 'shopAttributeValue_creatorId' }),
  updater: one(sysUser, { fields: [shopAttributeValue.updaterId], references: [sysUser.id], relationName: 'shopAttributeValue_updaterId' }),
  shopSkuAttribute_value_id: many(shopSkuAttribute, { relationName: 'shopSkuAttribute_valueId' })
}))

export const shopProductRelations = relations(shopProduct, ({ one, many }) => ({
  category: one(shopCategory, { fields: [shopProduct.categoryId], references: [shopCategory.id], relationName: 'shopProduct_categoryId' }),
  creator: one(sysUser, { fields: [shopProduct.creatorId], references: [sysUser.id], relationName: 'shopProduct_creatorId' }),
  updater: one(sysUser, { fields: [shopProduct.updaterId], references: [sysUser.id], relationName: 'shopProduct_updaterId' }),
  shopSku_product_id: many(shopSku, { relationName: 'shopSku_productId' }),
  shopCart_product_id: many(shopCart, { relationName: 'shopCart_productId' }),
  shopOrderItem_product_id: many(shopOrderItem, { relationName: 'shopOrderItem_productId' })
}))

export const shopSkuRelations = relations(shopSku, ({ one, many }) => ({
  product: one(shopProduct, { fields: [shopSku.productId], references: [shopProduct.id], relationName: 'shopSku_productId' }),
  creator: one(sysUser, { fields: [shopSku.creatorId], references: [sysUser.id], relationName: 'shopSku_creatorId' }),
  updater: one(sysUser, { fields: [shopSku.updaterId], references: [sysUser.id], relationName: 'shopSku_updaterId' }),
  shopSkuAttribute_sku_id: many(shopSkuAttribute, { relationName: 'shopSkuAttribute_skuId' }),
  shopCart_sku_id: many(shopCart, { relationName: 'shopCart_skuId' }),
  shopOrderItem_sku_id: many(shopOrderItem, { relationName: 'shopOrderItem_skuId' })
}))

export const shopSkuAttributeRelations = relations(shopSkuAttribute, ({ one, many }) => ({
  sku: one(shopSku, { fields: [shopSkuAttribute.skuId], references: [shopSku.id], relationName: 'shopSkuAttribute_skuId' }),
  attribute: one(shopAttribute, { fields: [shopSkuAttribute.attributeId], references: [shopAttribute.id], relationName: 'shopSkuAttribute_attributeId' }),
  value: one(shopAttributeValue, { fields: [shopSkuAttribute.valueId], references: [shopAttributeValue.id], relationName: 'shopSkuAttribute_valueId' })
}))

export const shopAddressRelations = relations(shopAddress, ({ one, many }) => ({
  user: one(sysUser, { fields: [shopAddress.userId], references: [sysUser.id], relationName: 'shopAddress_userId' }),
  creator: one(sysUser, { fields: [shopAddress.creatorId], references: [sysUser.id], relationName: 'shopAddress_creatorId' }),
  updater: one(sysUser, { fields: [shopAddress.updaterId], references: [sysUser.id], relationName: 'shopAddress_updaterId' }),
  shopOrder_address_id: many(shopOrder, { relationName: 'shopOrder_addressId' })
}))

export const shopCartRelations = relations(shopCart, ({ one, many }) => ({
  user: one(sysUser, { fields: [shopCart.userId], references: [sysUser.id], relationName: 'shopCart_userId' }),
  product: one(shopProduct, { fields: [shopCart.productId], references: [shopProduct.id], relationName: 'shopCart_productId' }),
  sku: one(shopSku, { fields: [shopCart.skuId], references: [shopSku.id], relationName: 'shopCart_skuId' }),
  creator: one(sysUser, { fields: [shopCart.creatorId], references: [sysUser.id], relationName: 'shopCart_creatorId' }),
  updater: one(sysUser, { fields: [shopCart.updaterId], references: [sysUser.id], relationName: 'shopCart_updaterId' })
}))

export const shopOrderRelations = relations(shopOrder, ({ one, many }) => ({
  user: one(sysUser, { fields: [shopOrder.userId], references: [sysUser.id], relationName: 'shopOrder_userId' }),
  address: one(shopAddress, { fields: [shopOrder.addressId], references: [shopAddress.id], relationName: 'shopOrder_addressId' }),
  creator: one(sysUser, { fields: [shopOrder.creatorId], references: [sysUser.id], relationName: 'shopOrder_creatorId' }),
  updater: one(sysUser, { fields: [shopOrder.updaterId], references: [sysUser.id], relationName: 'shopOrder_updaterId' }),
  shopOrderItem_order_id: many(shopOrderItem, { relationName: 'shopOrderItem_orderId' })
}))

export const shopOrderItemRelations = relations(shopOrderItem, ({ one, many }) => ({
  order: one(shopOrder, { fields: [shopOrderItem.orderId], references: [shopOrder.id], relationName: 'shopOrderItem_orderId' }),
  product: one(shopProduct, { fields: [shopOrderItem.productId], references: [shopProduct.id], relationName: 'shopOrderItem_productId' }),
  sku: one(shopSku, { fields: [shopOrderItem.skuId], references: [shopSku.id], relationName: 'shopOrderItem_skuId' }),
  creator: one(sysUser, { fields: [shopOrderItem.creatorId], references: [sysUser.id], relationName: 'shopOrderItem_creatorId' }),
  updater: one(sysUser, { fields: [shopOrderItem.updaterId], references: [sysUser.id], relationName: 'shopOrderItem_updaterId' })
}))

