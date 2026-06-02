/**
 * 商城模块消息定义
 */

export const ShopMessageKeys = {
  // 分类
  CATEGORY_LIST_SUCCESS: "CATEGORY_LIST_SUCCESS",
  CATEGORY_DETAIL_SUCCESS: "CATEGORY_DETAIL_SUCCESS",
  CATEGORY_TREE_SUCCESS: "CATEGORY_TREE_SUCCESS",
  CREATE_SUCCESS: "CATEGORY_CREATE_SUCCESS",
  UPDATE_SUCCESS: "CATEGORY_UPDATE_SUCCESS",
  DELETE_SUCCESS: "CATEGORY_DELETE_SUCCESS",

  // 属性
  ATTRIBUTE_LIST_SUCCESS: "ATTRIBUTE_LIST_SUCCESS",
  ATTRIBUTE_DETAIL_SUCCESS: "ATTRIBUTE_DETAIL_SUCCESS",
  ATTRIBUTE_CREATE_SUCCESS: "ATTRIBUTE_CREATE_SUCCESS",
  ATTRIBUTE_UPDATE_SUCCESS: "ATTRIBUTE_UPDATE_SUCCESS",
  ATTRIBUTE_DELETE_SUCCESS: "ATTRIBUTE_DELETE_SUCCESS",
  ATTRIBUTE_VALUE_CREATE_SUCCESS: "ATTRIBUTE_VALUE_CREATE_SUCCESS",
  ATTRIBUTE_VALUE_UPDATE_SUCCESS: "ATTRIBUTE_VALUE_UPDATE_SUCCESS",
  ATTRIBUTE_VALUE_DELETE_SUCCESS: "ATTRIBUTE_VALUE_DELETE_SUCCESS",

  // SKU
  SKU_LIST_SUCCESS: "SKU_LIST_SUCCESS",
  SKU_DETAIL_SUCCESS: "SKU_DETAIL_SUCCESS",
  SKU_CREATE_SUCCESS: "SKU_CREATE_SUCCESS",
  SKU_UPDATE_SUCCESS: "SKU_UPDATE_SUCCESS",
  SKU_DELETE_SUCCESS: "SKU_DELETE_SUCCESS",

  // 商品
  PRODUCT_LIST_SUCCESS: "PRODUCT_LIST_SUCCESS",
  PRODUCT_DETAIL_SUCCESS: "PRODUCT_DETAIL_SUCCESS",
  PRODUCT_CREATE_SUCCESS: "PRODUCT_CREATE_SUCCESS",
  PRODUCT_UPDATE_SUCCESS: "PRODUCT_UPDATE_SUCCESS",
  PRODUCT_DELETE_SUCCESS: "PRODUCT_DELETE_SUCCESS",
  PRODUCT_STATUS_UPDATE_SUCCESS: "PRODUCT_STATUS_UPDATE_SUCCESS",
  PRODUCT_RESTORE_SUCCESS: "PRODUCT_RESTORE_SUCCESS",

  // 订单
  ORDER_LIST_SUCCESS: "ORDER_LIST_SUCCESS",
  ORDER_DETAIL_SUCCESS: "ORDER_DETAIL_SUCCESS",
  ORDER_CREATE_SUCCESS: "ORDER_CREATE_SUCCESS",
  ORDER_STATUS_UPDATE_SUCCESS: "ORDER_STATUS_UPDATE_SUCCESS",
  ORDER_DELIVER_SUCCESS: "ORDER_DELIVER_SUCCESS",
  ORDER_DELETE_SUCCESS: "ORDER_DELETE_SUCCESS",

  // 购物车
  CART_LIST_SUCCESS: "CART_LIST_SUCCESS",
  CART_ADD_SUCCESS: "CART_ADD_SUCCESS",
  CART_UPDATE_SUCCESS: "CART_UPDATE_SUCCESS",
  CART_REMOVE_SUCCESS: "CART_REMOVE_SUCCESS",
  CART_CLEAR_SUCCESS: "CART_CLEAR_SUCCESS",

  // 地址
  ADDRESS_LIST_SUCCESS: "ADDRESS_LIST_SUCCESS",
  ADDRESS_DETAIL_SUCCESS: "ADDRESS_DETAIL_SUCCESS",
  ADDRESS_CREATE_SUCCESS: "ADDRESS_CREATE_SUCCESS",
  ADDRESS_UPDATE_SUCCESS: "ADDRESS_UPDATE_SUCCESS",
  ADDRESS_DELETE_SUCCESS: "ADDRESS_DELETE_SUCCESS",
  ADDRESS_SET_DEFAULT_SUCCESS: "ADDRESS_SET_DEFAULT_SUCCESS",
} as const;

export type ShopMessageKey = (typeof ShopMessageKeys)[keyof typeof ShopMessageKeys];

const messages: Record<string, Record<string, string>> = {
  "zh-CN": {
    // 分类
    CATEGORY_LIST_SUCCESS: "获取分类列表成功",
    CATEGORY_DETAIL_SUCCESS: "获取分类详情成功",
    CATEGORY_TREE_SUCCESS: "获取分类树成功",
    CREATE_SUCCESS: "创建分类成功",
    UPDATE_SUCCESS: "更新分类成功",
    DELETE_SUCCESS: "删除分类成功",

    // 属性
    ATTRIBUTE_LIST_SUCCESS: "获取属性列表成功",
    ATTRIBUTE_DETAIL_SUCCESS: "获取属性详情成功",
    ATTRIBUTE_CREATE_SUCCESS: "创建属性成功",
    ATTRIBUTE_UPDATE_SUCCESS: "更新属性成功",
    ATTRIBUTE_DELETE_SUCCESS: "删除属性成功",
    ATTRIBUTE_VALUE_CREATE_SUCCESS: "创建属性值成功",
    ATTRIBUTE_VALUE_UPDATE_SUCCESS: "更新属性值成功",
    ATTRIBUTE_VALUE_DELETE_SUCCESS: "删除属性值成功",

    // SKU
    SKU_LIST_SUCCESS: "获取SKU列表成功",
    SKU_DETAIL_SUCCESS: "获取SKU详情成功",
    SKU_CREATE_SUCCESS: "创建SKU成功",
    SKU_UPDATE_SUCCESS: "更新SKU成功",
    SKU_DELETE_SUCCESS: "删除SKU成功",

    // 商品
    PRODUCT_LIST_SUCCESS: "获取商品列表成功",
    PRODUCT_DETAIL_SUCCESS: "获取商品详情成功",
    PRODUCT_CREATE_SUCCESS: "创建商品成功",
    PRODUCT_UPDATE_SUCCESS: "更新商品成功",
    PRODUCT_DELETE_SUCCESS: "删除商品成功",
    PRODUCT_STATUS_UPDATE_SUCCESS: "更新商品状态成功",
    PRODUCT_RESTORE_SUCCESS: "恢复商品成功",

    // 订单
    ORDER_LIST_SUCCESS: "获取订单列表成功",
    ORDER_DETAIL_SUCCESS: "获取订单详情成功",
    ORDER_CREATE_SUCCESS: "创建订单成功",
    ORDER_STATUS_UPDATE_SUCCESS: "更新订单状态成功",
    ORDER_DELIVER_SUCCESS: "订单发货成功",
    ORDER_DELETE_SUCCESS: "删除订单成功",

    // 购物车
    CART_LIST_SUCCESS: "获取购物车成功",
    CART_ADD_SUCCESS: "添加购物车成功",
    CART_UPDATE_SUCCESS: "更新购物车成功",
    CART_REMOVE_SUCCESS: "移除购物车成功",
    CART_CLEAR_SUCCESS: "清空购物车成功",

    // 地址
    ADDRESS_LIST_SUCCESS: "获取地址列表成功",
    ADDRESS_DETAIL_SUCCESS: "获取地址详情成功",
    ADDRESS_CREATE_SUCCESS: "创建地址成功",
    ADDRESS_UPDATE_SUCCESS: "更新地址成功",
    ADDRESS_DELETE_SUCCESS: "删除地址成功",
    ADDRESS_SET_DEFAULT_SUCCESS: "设置默认地址成功",
  },
  en: {
    CATEGORY_LIST_SUCCESS: "Category list retrieved successfully",
    CATEGORY_DETAIL_SUCCESS: "Category detail retrieved successfully",
    CATEGORY_TREE_SUCCESS: "Category tree retrieved successfully",
    CREATE_SUCCESS: "Category created successfully",
    UPDATE_SUCCESS: "Category updated successfully",
    DELETE_SUCCESS: "Category deleted successfully",
    ATTRIBUTE_LIST_SUCCESS: "Attribute list retrieved successfully",
    ATTRIBUTE_DETAIL_SUCCESS: "Attribute detail retrieved successfully",
    ATTRIBUTE_CREATE_SUCCESS: "Attribute created successfully",
    ATTRIBUTE_UPDATE_SUCCESS: "Attribute updated successfully",
    ATTRIBUTE_DELETE_SUCCESS: "Attribute deleted successfully",
    ATTRIBUTE_VALUE_CREATE_SUCCESS: "Attribute value created successfully",
    ATTRIBUTE_VALUE_UPDATE_SUCCESS: "Attribute value updated successfully",
    ATTRIBUTE_VALUE_DELETE_SUCCESS: "Attribute value deleted successfully",
    SKU_LIST_SUCCESS: "SKU list retrieved successfully",
    SKU_DETAIL_SUCCESS: "SKU detail retrieved successfully",
    SKU_CREATE_SUCCESS: "SKU created successfully",
    SKU_UPDATE_SUCCESS: "SKU updated successfully",
    SKU_DELETE_SUCCESS: "SKU deleted successfully",
    PRODUCT_LIST_SUCCESS: "Product list retrieved successfully",
    PRODUCT_DETAIL_SUCCESS: "Product detail retrieved successfully",
    PRODUCT_CREATE_SUCCESS: "Product created successfully",
    PRODUCT_UPDATE_SUCCESS: "Product updated successfully",
    PRODUCT_DELETE_SUCCESS: "Product deleted successfully",
    PRODUCT_STATUS_UPDATE_SUCCESS: "Product status updated successfully",
    PRODUCT_RESTORE_SUCCESS: "Product restored successfully",
    ORDER_LIST_SUCCESS: "Order list retrieved successfully",
    ORDER_DETAIL_SUCCESS: "Order detail retrieved successfully",
    ORDER_CREATE_SUCCESS: "Order created successfully",
    ORDER_STATUS_UPDATE_SUCCESS: "Order status updated successfully",
    ORDER_DELIVER_SUCCESS: "Order delivered successfully",
    ORDER_DELETE_SUCCESS: "Order deleted successfully",
    CART_LIST_SUCCESS: "Cart retrieved successfully",
    CART_ADD_SUCCESS: "Added to cart successfully",
    CART_UPDATE_SUCCESS: "Cart updated successfully",
    CART_REMOVE_SUCCESS: "Removed from cart successfully",
    CART_CLEAR_SUCCESS: "Cart cleared successfully",
    ADDRESS_LIST_SUCCESS: "Address list retrieved successfully",
    ADDRESS_DETAIL_SUCCESS: "Address detail retrieved successfully",
    ADDRESS_CREATE_SUCCESS: "Address created successfully",
    ADDRESS_UPDATE_SUCCESS: "Address updated successfully",
    ADDRESS_DELETE_SUCCESS: "Address deleted successfully",
    ADDRESS_SET_DEFAULT_SUCCESS: "Default address set successfully",
  },
};

export function getShopMessage(key: ShopMessageKey, lang: string = "zh-CN"): string {
  return messages[lang]?.[key] || messages["zh-CN"][key] || key;
}
