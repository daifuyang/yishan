import { SysAppResourceModel } from "../models/sys-app-resource.model.js";
import {
  CreateFormFieldReq,
  CreateFormRecordReq,
  CreateFormReq,
  FormFieldListQuery,
  FormListQuery,
  FormRecordListQuery,
  SysFormFieldResp,
  SysFormRecordResp,
  SysFormResp,
  UpdateFormFieldReq,
  UpdateFormRecordReq,
  UpdateFormReq,
} from "../schemas/form.js";
import { BusinessError } from "../exceptions/business-error.js";
import { FormErrorCode } from "../constants/business-codes/form.js";
import { AppErrorCode } from "../constants/business-codes/app.js";
import { SysAppModel } from "../models/sys-app.model.js";
import { SysFormFieldModel } from "../models/sys-form-field.model.js";
import { SysFormDataModel } from "../models/sys-form-data.model.js";

const FORM_RESOURCE_TYPE = "FORM";

export class FormService {
  static async getFormList(appId: number, query: FormListQuery) {
    await this.ensureAppExists(appId);
    const list = await SysAppResourceModel.getResourceList(appId, { ...query, type: FORM_RESOURCE_TYPE });
    const total = await SysAppResourceModel.getResourceTotal(appId, { ...query, type: FORM_RESOURCE_TYPE });
    return {
      list: list as unknown as SysFormResp[],
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getFormById(appId: number, id: number) {
    await this.ensureAppExists(appId);
    const form = await this.ensureFormResource(appId, id);
    return form as unknown as SysFormResp;
  }

  static async createForm(appId: number, req: CreateFormReq, userId: number): Promise<SysFormResp> {
    await this.ensureAppExists(appId);
    const created = await SysAppResourceModel.createResource(
      appId,
      {
        type: FORM_RESOURCE_TYPE,
        name: req.name,
        description: req.description,
        status: req.status,
        sort_order: req.sort_order,
        config: req.config,
      },
      userId
    );
    return created as unknown as SysFormResp;
  }

  static async updateForm(appId: number, id: number, req: UpdateFormReq, userId: number): Promise<SysFormResp> {
    await this.ensureAppExists(appId);
    await this.ensureFormResource(appId, id);
    const updated = await SysAppResourceModel.updateResource(
      appId,
      id,
      {
        name: req.name,
        description: req.description,
        status: req.status,
        sort_order: req.sort_order,
        config: req.config,
      },
      userId
    );
    return updated as unknown as SysFormResp;
  }

  static async deleteForm(appId: number, id: number, userId: number): Promise<{ id: number }> {
    await this.ensureAppExists(appId);
    await this.ensureFormResource(appId, id);
    const res = await SysAppResourceModel.deleteResource(appId, id, userId);
    if (!res) {
      throw new BusinessError(FormErrorCode.FORM_NOT_FOUND, "表单不存在或已删除");
    }
    return res;
  }

  static async getFieldList(appId: number, formId: number, query: FormFieldListQuery) {
    await this.ensureFormResource(appId, formId);
    const list = await SysFormFieldModel.getFieldList(formId, query);
    const total = await SysFormFieldModel.getFieldTotal(formId, query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getFieldById(appId: number, formId: number, fieldId: number) {
    await this.ensureFormResource(appId, formId);
    return await SysFormFieldModel.getFieldById(formId, fieldId);
  }

  static async createField(
    appId: number,
    formId: number,
    req: CreateFormFieldReq,
    userId: number
  ): Promise<SysFormFieldResp> {
    await this.ensureFormResource(appId, formId);
    await this.ensureFieldUnique(formId, req.key);
    return await SysFormFieldModel.createField(formId, req, userId);
  }

  static async updateField(
    appId: number,
    formId: number,
    fieldId: number,
    req: UpdateFormFieldReq,
    userId: number
  ): Promise<SysFormFieldResp> {
    await this.ensureFormResource(appId, formId);
    const existing = await SysFormFieldModel.getFieldById(formId, fieldId);
    if (!existing) {
      throw new BusinessError(FormErrorCode.FORM_FIELD_NOT_FOUND, "表单字段不存在");
    }
    const nextKey = req.key ?? existing.key;
    if (nextKey !== existing.key) {
      await this.ensureFieldUnique(formId, nextKey, fieldId);
    }
    return await SysFormFieldModel.updateField(formId, fieldId, req, userId);
  }

  static async deleteField(appId: number, formId: number, fieldId: number, userId: number): Promise<{ id: number }> {
    await this.ensureFormResource(appId, formId);
    const existing = await SysFormFieldModel.getFieldById(formId, fieldId);
    if (!existing) {
      throw new BusinessError(FormErrorCode.FORM_FIELD_NOT_FOUND, "表单字段不存在");
    }
    const res = await SysFormFieldModel.deleteField(formId, fieldId, userId);
    if (!res) {
      throw new BusinessError(FormErrorCode.FORM_FIELD_NOT_FOUND, "表单字段不存在或已删除");
    }
    return res;
  }

  static async getRecordList(appId: number, formId: number, query: FormRecordListQuery) {
    await this.ensureFormResource(appId, formId);
    const list = await SysFormDataModel.getRecordList(formId, query);
    const total = await SysFormDataModel.getRecordTotal(formId, query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getRecordById(appId: number, formId: number, recordId: number) {
    await this.ensureFormResource(appId, formId);
    return await SysFormDataModel.getRecordById(formId, recordId);
  }

  static async createRecord(
    appId: number,
    formId: number,
    req: CreateFormRecordReq,
    userId: number
  ): Promise<SysFormRecordResp> {
    await this.ensureFormResource(appId, formId);
    return await SysFormDataModel.createRecord(formId, req, userId);
  }

  static async updateRecord(
    appId: number,
    formId: number,
    recordId: number,
    req: UpdateFormRecordReq,
    userId: number
  ): Promise<SysFormRecordResp> {
    await this.ensureFormResource(appId, formId);
    const existing = await SysFormDataModel.getRecordById(formId, recordId);
    if (!existing) {
      throw new BusinessError(FormErrorCode.FORM_RECORD_NOT_FOUND, "表单数据不存在");
    }
    return await SysFormDataModel.updateRecord(formId, recordId, req, userId);
  }

  static async deleteRecord(appId: number, formId: number, recordId: number, userId: number): Promise<{ id: number }> {
    await this.ensureFormResource(appId, formId);
    const existing = await SysFormDataModel.getRecordById(formId, recordId);
    if (!existing) {
      throw new BusinessError(FormErrorCode.FORM_RECORD_NOT_FOUND, "表单数据不存在");
    }
    const res = await SysFormDataModel.deleteRecord(formId, recordId, userId);
    if (!res) {
      throw new BusinessError(FormErrorCode.FORM_RECORD_NOT_FOUND, "表单数据不存在或已删除");
    }
    return res;
  }

  private static async ensureFieldUnique(resourceId: number, key: string, excludeId?: number): Promise<void> {
    const dup = await SysFormFieldModel.getFieldByKey(resourceId, key);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(FormErrorCode.FORM_FIELD_ALREADY_EXISTS, "表单字段已存在");
    }
  }

  private static async ensureFormResource(appId: number, id: number): Promise<SysFormResp> {
    const resource = await SysAppResourceModel.getResourceById(appId, id);
    if (!resource || resource.type !== FORM_RESOURCE_TYPE) {
      throw new BusinessError(FormErrorCode.FORM_NOT_FOUND, "表单不存在");
    }
    return resource as unknown as SysFormResp;
  }

  private static async ensureAppExists(appId: number): Promise<void> {
    const app = await SysAppModel.getAppById(appId);
    if (!app) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在");
    }
  }
}
