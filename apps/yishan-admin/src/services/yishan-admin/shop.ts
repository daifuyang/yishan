export {
  getModulesShopV1AdminCategories as getCategoryList,
  getModulesShopV1AdminCategoriesTree as getCategoryTree,
  getModulesShopV1AdminCategoriesId as getCategoryDetail,
  postModulesShopV1AdminCategories as createCategory,
  putModulesShopV1AdminCategoriesId as updateCategory,
  deleteModulesShopV1AdminCategoriesId as deleteCategory,
} from './shopCategories';

export {
  getModulesShopV1AdminAttributes as getAttributeList,
  getModulesShopV1AdminAttributesSpecs as getSpecAttributes,
  getModulesShopV1AdminAttributesId as getAttributeDetail,
  postModulesShopV1AdminAttributes as createAttribute,
  putModulesShopV1AdminAttributesId as updateAttribute,
  deleteModulesShopV1AdminAttributesId as deleteAttribute,
  postModulesShopV1AdminAttributesIdValues as createAttributeValue,
  putModulesShopV1AdminAttributesValuesValueId as updateAttributeValue,
  deleteModulesShopV1AdminAttributesValuesValueId as deleteAttributeValue,
} from './shopAttributes';

export {
  getProductList,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  moveProductToRecycle as moveToRecycle,
  restoreProductFromRecycle as restoreProduct,
} from './shopProducts';

export {
  getModulesShopV1AdminSkus as getSkuList,
  getModulesShopV1AdminSkusId as getSkuDetail,
  postModulesShopV1AdminSkus as createSku,
  putModulesShopV1AdminSkusId as updateSku,
  deleteModulesShopV1AdminSkusId as deleteSku,
} from './shopSkus';

export {
  getOrderList,
  getOrderDetail,
  updateOrderStatus,
  deliverOrder,
  deleteOrder,
} from './shopOrders';
