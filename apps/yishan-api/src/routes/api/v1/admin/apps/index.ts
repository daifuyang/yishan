import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { AppListQuery, SaveAppReq, UpdateAppReq } from "../../../../../schemas/app.js";
import {
  AppResourceListQuery,
  CreateAppResourceReq,
  UpdateAppResourceReq,
} from "../../../../../schemas/app-resource.js";
import { AppMenuListQuery, SaveAppMenuReq, UpdateAppMenuReq } from "../../../../../schemas/app-menu.js";
import {
  CreateFormFieldReq,
  CreateFormRecordReq,
  CreateFormReq,
  FormFieldListQuery,
  FormListQuery,
  FormRecordListQuery,
  UpdateFormFieldReq,
  UpdateFormRecordReq,
  UpdateFormReq,
} from "../../../../../schemas/form.js";
import { AppService } from "../../../../../services/app.service.js";
import { AppResourceService } from "../../../../../services/app-resource.service.js";
import { AppMenuService } from "../../../../../services/app-menu.service.js";
import { FormService } from "../../../../../services/form.service.js";
import { getAppMessage, AppMessageKeys } from "../../../../../constants/messages/app.js";
import { getAppResourceMessage, AppResourceMessageKeys } from "../../../../../constants/messages/app-resource.js";
import { getAppMenuMessage, AppMenuMessageKeys } from "../../../../../constants/messages/app-menu.js";
import { getFormMessage, FormMessageKeys } from "../../../../../constants/messages/form.js";
import { AppResourceErrorCode } from "../../../../../constants/business-codes/app-resource.js";
import { AppMenuErrorCode } from "../../../../../constants/business-codes/app-menu.js";
import { FormErrorCode } from "../../../../../constants/business-codes/form.js";

const adminApps: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取应用列表",
        description: "分页获取应用列表，支持关键词与状态过滤",
        operationId: "getAppList",
        tags: ["sysApps"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "appListQuery#" },
        response: { 200: { $ref: "appListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: AppListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await AppService.getAppList(request.query);
      const message = getAppMessage(AppMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取应用详情",
        description: "根据应用ID获取应用详情",
        operationId: "getAppDetail",
        tags: ["sysApps"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "appDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const id = request.params.id;
      const app = await AppService.getAppById(id);
      if (!app) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "应用不存在");
      }
      const message = getAppMessage(AppMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, app, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建应用",
        description: "创建一个新的应用",
        operationId: "createApp",
        tags: ["sysApps"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveAppReq#" },
        response: { 200: { $ref: "appDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: SaveAppReq }>, reply: FastifyReply) => {
      const app = await AppService.createApp(request.body, request.currentUser.id);
      const message = getAppMessage(AppMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, app, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新应用",
        description: "根据应用ID更新应用",
        operationId: "updateApp",
        tags: ["sysApps"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "updateAppReq#" },
        response: { 200: { $ref: "appDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateAppReq }>, reply: FastifyReply) => {
      const app = await AppService.updateApp(request.params.id, request.body, request.currentUser.id);
      const message = getAppMessage(AppMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, app, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除应用",
        description: "根据应用ID软删除应用",
        operationId: "deleteApp",
        tags: ["sysApps"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "appDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await AppService.deleteApp(request.params.id, request.currentUser.id);
      const message = getAppMessage(AppMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/:appId/resources",
    {
      schema: {
        summary: "获取应用资源列表",
        description: "分页获取应用资源列表，支持关键词、类型与状态过滤",
        operationId: "getAppResourceList",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        querystring: { $ref: "appResourceListQuery#" },
        response: { 200: { $ref: "appResourceListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Querystring: AppResourceListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await AppResourceService.getResourceList(request.params.appId, request.query);
      const message = getAppResourceMessage(AppResourceMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:appId/resources/tree",
    {
      schema: {
        summary: "获取应用资源树",
        description: "获取指定应用的资源树",
        operationId: "getAppResourceTree",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "appResourceTreeResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number } }>,
      reply: FastifyReply
    ) => {
      const tree = await AppResourceService.getResourceTree(request.params.appId);
      const message = getAppResourceMessage(AppResourceMessageKeys.TREE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, tree, message);
    }
  );

  fastify.get(
    "/:appId/resources/:id",
    {
      schema: {
        summary: "获取应用资源详情",
        description: "根据应用资源ID获取详情",
        operationId: "getAppResourceDetail",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "appResourceDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number } }>,
      reply: FastifyReply
    ) => {
      const resource = await AppResourceService.getResourceById(request.params.appId, request.params.id);
      if (!resource) {
        throw new BusinessError(AppResourceErrorCode.APP_RESOURCE_NOT_FOUND, "应用资源不存在");
      }
      const message = getAppResourceMessage(AppResourceMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, resource, message);
    }
  );

  fastify.post(
    "/:appId/resources",
    {
      schema: {
        summary: "创建应用资源",
        description: "在指定应用下创建资源",
        operationId: "createAppResource",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "createAppResourceReq#" },
        response: { 200: { $ref: "appResourceDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Body: CreateAppResourceReq }>,
      reply: FastifyReply
    ) => {
      const resource = await AppResourceService.createResource(request.params.appId, request.body, request.currentUser.id);
      const message = getAppResourceMessage(AppResourceMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, resource, message);
    }
  );

  fastify.put(
    "/:appId/resources/:id",
    {
      schema: {
        summary: "更新应用资源",
        description: "根据资源ID更新应用资源",
        operationId: "updateAppResource",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "updateAppResourceReq#" },
        response: { 200: { $ref: "appResourceDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number }; Body: UpdateAppResourceReq }>,
      reply: FastifyReply
    ) => {
      const resource = await AppResourceService.updateResource(
        request.params.appId,
        request.params.id,
        request.body,
        request.currentUser.id
      );
      const message = getAppResourceMessage(AppResourceMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, resource, message);
    }
  );

  fastify.delete(
    "/:appId/resources/:id",
    {
      schema: {
        summary: "删除应用资源",
        description: "根据资源ID软删除应用资源",
        operationId: "deleteAppResource",
        tags: ["sysAppResources"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "appResourceDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number } }>,
      reply: FastifyReply
    ) => {
      const result = await AppResourceService.deleteResource(request.params.appId, request.params.id, request.currentUser.id);
      const message = getAppResourceMessage(AppResourceMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/:appId/menus",
    {
      schema: {
        summary: "获取应用菜单列表",
        description: "分页获取应用菜单列表，支持关键词、状态、类型与父级过滤",
        operationId: "getAppMenuList",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        querystring: { $ref: "appMenuListQuery#" },
        response: { 200: { $ref: "appMenuListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Querystring: AppMenuListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await AppMenuService.getMenuList(request.params.appId, request.query);
      const message = getAppMenuMessage(AppMenuMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:appId/menus/tree",
    {
      schema: {
        summary: "获取应用菜单树",
        description: "获取指定应用的树形菜单",
        operationId: "getAppMenuTree",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "appMenuTreeResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number } }>,
      reply: FastifyReply
    ) => {
      const tree = await AppMenuService.getMenuTree(request.params.appId);
      const message = getAppMenuMessage(AppMenuMessageKeys.TREE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, tree, message);
    }
  );

  fastify.get(
    "/:appId/menus/:id",
    {
      schema: {
        summary: "获取应用菜单详情",
        description: "根据应用菜单ID获取详情",
        operationId: "getAppMenuDetail",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "appMenuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number } }>,
      reply: FastifyReply
    ) => {
      const menu = await AppMenuService.getMenuById(request.params.appId, request.params.id);
      if (!menu) {
        throw new BusinessError(AppMenuErrorCode.APP_MENU_NOT_FOUND, "应用菜单不存在");
      }
      const message = getAppMenuMessage(AppMenuMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, menu, message);
    }
  );

  fastify.post(
    "/:appId/menus",
    {
      schema: {
        summary: "创建应用菜单",
        description: "在指定应用下创建菜单",
        operationId: "createAppMenu",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "saveAppMenuReq#" },
        response: { 200: { $ref: "appMenuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Body: SaveAppMenuReq }>,
      reply: FastifyReply
    ) => {
      const menu = await AppMenuService.createMenu(request.params.appId, request.body, request.currentUser.id);
      const message = getAppMenuMessage(AppMenuMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, menu, message);
    }
  );

  fastify.put(
    "/:appId/menus/:id",
    {
      schema: {
        summary: "更新应用菜单",
        description: "根据应用菜单ID更新菜单信息",
        operationId: "updateAppMenu",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "updateAppMenuReq#" },
        response: { 200: { $ref: "appMenuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number }; Body: UpdateAppMenuReq }>,
      reply: FastifyReply
    ) => {
      const menu = await AppMenuService.updateMenu(
        request.params.appId,
        request.params.id,
        request.body,
        request.currentUser.id
      );
      const message = getAppMenuMessage(AppMenuMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, menu, message);
    }
  );

  fastify.delete(
    "/:appId/menus/:id",
    {
      schema: {
        summary: "删除应用菜单",
        description: "根据应用菜单ID软删除菜单",
        operationId: "deleteAppMenu",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          id: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "appMenuDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; id: number } }>,
      reply: FastifyReply
    ) => {
      const result = await AppMenuService.deleteMenu(request.params.appId, request.params.id, request.currentUser.id);
      const message = getAppMenuMessage(AppMenuMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/:appId/forms",
    {
      schema: {
        summary: "获取表单列表",
        description: "分页获取应用内表单列表",
        operationId: "getFormList",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        querystring: { $ref: "formListQuery#" },
        response: { 200: { $ref: "formListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Querystring: FormListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await FormService.getFormList(request.params.appId, request.query);
      const message = getFormMessage(FormMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:appId/forms/:formId",
    {
      schema: {
        summary: "获取表单详情",
        description: "根据表单ID获取详情",
        operationId: "getFormDetail",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number } }>,
      reply: FastifyReply
    ) => {
      const form = await FormService.getFormById(request.params.appId, request.params.formId);
      const message = getFormMessage(FormMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, form, message);
    }
  );

  fastify.post(
    "/:appId/forms",
    {
      schema: {
        summary: "创建表单",
        description: "在指定应用下创建表单",
        operationId: "createForm",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ appId: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "createFormReq#" },
        response: { 200: { $ref: "formDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number }; Body: CreateFormReq }>,
      reply: FastifyReply
    ) => {
      const form = await FormService.createForm(request.params.appId, request.body, request.currentUser.id);
      const message = getFormMessage(FormMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, form, message);
    }
  );

  fastify.put(
    "/:appId/forms/:formId",
    {
      schema: {
        summary: "更新表单",
        description: "根据表单ID更新表单",
        operationId: "updateForm",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "updateFormReq#" },
        response: { 200: { $ref: "formDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number }; Body: UpdateFormReq }>,
      reply: FastifyReply
    ) => {
      const form = await FormService.updateForm(
        request.params.appId,
        request.params.formId,
        request.body,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, form, message);
    }
  );

  fastify.delete(
    "/:appId/forms/:formId",
    {
      schema: {
        summary: "删除表单",
        description: "根据表单ID软删除表单",
        operationId: "deleteForm",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number } }>,
      reply: FastifyReply
    ) => {
      const result = await FormService.deleteForm(request.params.appId, request.params.formId, request.currentUser.id);
      const message = getFormMessage(FormMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/:appId/forms/:formId/fields",
    {
      schema: {
        summary: "获取表单字段列表",
        description: "分页获取表单字段列表",
        operationId: "getFormFieldList",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        querystring: { $ref: "formFieldListQuery#" },
        response: { 200: { $ref: "formFieldListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { appId: number; formId: number };
        Querystring: FormFieldListQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await FormService.getFieldList(request.params.appId, request.params.formId, request.query);
      const message = getFormMessage(FormMessageKeys.FIELD_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:appId/forms/:formId/fields/:fieldId",
    {
      schema: {
        summary: "获取表单字段详情",
        description: "根据字段ID获取详情",
        operationId: "getFormFieldDetail",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          fieldId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formFieldDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number; fieldId: number } }>,
      reply: FastifyReply
    ) => {
      const field = await FormService.getFieldById(request.params.appId, request.params.formId, request.params.fieldId);
      if (!field) {
        throw new BusinessError(FormErrorCode.FORM_FIELD_NOT_FOUND, "表单字段不存在");
      }
      const message = getFormMessage(FormMessageKeys.FIELD_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, field, message);
    }
  );

  fastify.post(
    "/:appId/forms/:formId/fields",
    {
      schema: {
        summary: "创建表单字段",
        description: "为指定表单创建字段",
        operationId: "createFormField",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "createFormFieldReq#" },
        response: { 200: { $ref: "formFieldDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number }; Body: CreateFormFieldReq }>,
      reply: FastifyReply
    ) => {
      const field = await FormService.createField(
        request.params.appId,
        request.params.formId,
        request.body,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.FIELD_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, field, message);
    }
  );

  fastify.put(
    "/:appId/forms/:formId/fields/:fieldId",
    {
      schema: {
        summary: "更新表单字段",
        description: "根据字段ID更新表单字段",
        operationId: "updateFormField",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          fieldId: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "updateFormFieldReq#" },
        response: { 200: { $ref: "formFieldDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { appId: number; formId: number; fieldId: number };
        Body: UpdateFormFieldReq;
      }>,
      reply: FastifyReply
    ) => {
      const field = await FormService.updateField(
        request.params.appId,
        request.params.formId,
        request.params.fieldId,
        request.body,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.FIELD_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, field, message);
    }
  );

  fastify.delete(
    "/:appId/forms/:formId/fields/:fieldId",
    {
      schema: {
        summary: "删除表单字段",
        description: "根据字段ID软删除表单字段",
        operationId: "deleteFormField",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          fieldId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formFieldDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number; fieldId: number } }>,
      reply: FastifyReply
    ) => {
      const result = await FormService.deleteField(
        request.params.appId,
        request.params.formId,
        request.params.fieldId,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.FIELD_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/:appId/forms/:formId/records",
    {
      schema: {
        summary: "获取表单数据列表",
        description: "分页获取表单数据列表",
        operationId: "getFormRecordList",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        querystring: { $ref: "formRecordListQuery#" },
        response: { 200: { $ref: "formRecordListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { appId: number; formId: number };
        Querystring: FormRecordListQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await FormService.getRecordList(request.params.appId, request.params.formId, request.query);
      const message = getFormMessage(FormMessageKeys.RECORD_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:appId/forms/:formId/records/:recordId",
    {
      schema: {
        summary: "获取表单数据详情",
        description: "根据数据ID获取详情",
        operationId: "getFormRecordDetail",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          recordId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formRecordDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number; recordId: number } }>,
      reply: FastifyReply
    ) => {
      const record = await FormService.getRecordById(
        request.params.appId,
        request.params.formId,
        request.params.recordId
      );
      if (!record) {
        throw new BusinessError(FormErrorCode.FORM_RECORD_NOT_FOUND, "表单数据不存在");
      }
      const message = getFormMessage(FormMessageKeys.RECORD_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, record, message);
    }
  );

  fastify.post(
    "/:appId/forms/:formId/records",
    {
      schema: {
        summary: "创建表单数据",
        description: "为指定表单创建数据",
        operationId: "createFormRecord",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "createFormRecordReq#" },
        response: { 200: { $ref: "formRecordDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number }; Body: CreateFormRecordReq }>,
      reply: FastifyReply
    ) => {
      const record = await FormService.createRecord(
        request.params.appId,
        request.params.formId,
        request.body,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.RECORD_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, record, message);
    }
  );

  fastify.put(
    "/:appId/forms/:formId/records/:recordId",
    {
      schema: {
        summary: "更新表单数据",
        description: "根据数据ID更新表单数据",
        operationId: "updateFormRecord",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          recordId: Type.Integer({ minimum: 1 }),
        }),
        body: { $ref: "updateFormRecordReq#" },
        response: { 200: { $ref: "formRecordDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { appId: number; formId: number; recordId: number };
        Body: UpdateFormRecordReq;
      }>,
      reply: FastifyReply
    ) => {
      const record = await FormService.updateRecord(
        request.params.appId,
        request.params.formId,
        request.params.recordId,
        request.body,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.RECORD_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, record, message);
    }
  );

  fastify.delete(
    "/:appId/forms/:formId/records/:recordId",
    {
      schema: {
        summary: "删除表单数据",
        description: "根据数据ID软删除表单数据",
        operationId: "deleteFormRecord",
        tags: ["sysForms"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          appId: Type.Integer({ minimum: 1 }),
          formId: Type.Integer({ minimum: 1 }),
          recordId: Type.Integer({ minimum: 1 }),
        }),
        response: { 200: { $ref: "formRecordDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { appId: number; formId: number; recordId: number } }>,
      reply: FastifyReply
    ) => {
      const result = await FormService.deleteRecord(
        request.params.appId,
        request.params.formId,
        request.params.recordId,
        request.currentUser.id
      );
      const message = getFormMessage(FormMessageKeys.RECORD_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default adminApps;
