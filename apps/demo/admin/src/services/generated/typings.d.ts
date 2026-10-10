declare namespace API {
  type deletePortalV1ArticlesIdParams = {
    id: number;
  };

  type deletePortalV1ArticleTemplatesIdParams = {
    id: number;
  };

  type deletePortalV1CategoriesIdParams = {
    id: number;
  };

  type deletePortalV1PagesIdParams = {
    id: number;
  };

  type deletePortalV1PageTemplatesIdParams = {
    id: number;
  };

  type deleteShopV1AttributesIdParams = {
    id: number;
  };

  type deleteShopV1AttributesIdValuesParams = {
    id: number;
  };

  type deleteShopV1CategoriesIdParams = {
    id: number;
  };

  type deleteShopV1OrdersIdParams = {
    id: number;
  };

  type deleteShopV1ProductsIdParams = {
    id: number;
  };

  type deleteShopV1ProductsSkusIdParams = {
    id: number;
  };

  type demoTodosDeleteParams = {
    id: string;
  };

  type demoTodosDetailParams = {
    id: string;
  };

  type demoTodosUpdateParams = {
    id: string;
  };

  type getPortalV1ArticlesIdParams = {
    id: number;
  };

  type getPortalV1ArticlesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number;
    categoryId?: number;
    templateId?: number;
  };

  type getPortalV1ArticleTemplatesIdParams = {
    id: number;
  };

  type getPortalV1ArticleTemplatesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: number;
    status?: number;
  };

  type getPortalV1CategoriesIdParams = {
    id: number;
  };

  type getPortalV1CategoriesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    parentId?: number;
    status?: number;
  };

  type getPortalV1PagesIdParams = {
    id: number;
  };

  type getPortalV1PagesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number;
  };

  type getPortalV1PageTemplatesIdParams = {
    id: number;
  };

  type getPortalV1PageTemplatesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: number;
    status?: number;
  };

  type getShopV1AttributesIdParams = {
    id: number;
  };

  type getShopV1AttributesIdValuesParams = {
    id: number;
  };

  type getShopV1AttributesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: number;
    status?: number;
  };

  type getShopV1CategoriesIdParams = {
    id: number;
  };

  type getShopV1CategoriesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    parentId?: number;
    status?: number;
  };

  type getShopV1OrdersIdItemsParams = {
    id: number;
  };

  type getShopV1OrdersIdParams = {
    id: number;
  };

  type getShopV1OrdersParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    userId?: number;
    orderStatus?: number;
    payStatus?: number;
  };

  type getShopV1ProductsIdParams = {
    id: number;
  };

  type getShopV1ProductsIdSkusParams = {
    id: number;
  };

  type getShopV1ProductsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    categoryId?: number;
    status?: number;
    isHot?: boolean;
    isNew?: boolean;
  };

  type patchPortalV1ArticlesIdParams = {
    id: number;
  };

  type patchPortalV1ArticleTemplatesIdParams = {
    id: number;
  };

  type patchPortalV1CategoriesIdParams = {
    id: number;
  };

  type patchPortalV1PagesIdParams = {
    id: number;
  };

  type patchPortalV1PageTemplatesIdParams = {
    id: number;
  };

  type patchShopV1AttributesIdParams = {
    id: number;
  };

  type patchShopV1CategoriesIdParams = {
    id: number;
  };

  type patchShopV1OrdersIdParams = {
    id: number;
  };

  type patchShopV1ProductsIdParams = {
    id: number;
  };

  type patchShopV1ProductsSkusIdParams = {
    id: number;
  };

  type postPortalV1ArticlesIdPublishParams = {
    id: number;
  };

  type postShopV1AttributesIdValuesParams = {
    id: number;
  };

  type postShopV1ProductsIdSkusParams = {
    id: number;
  };
}
