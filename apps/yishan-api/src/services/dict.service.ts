import { SysDictModel } from "../models/sys-dict.model.js";
import { BusinessError } from "../exceptions/business-error.js";
import { DictErrorCode } from "../constants/business-codes/dict.js";
import {
  DictDataListQuery,
  DictTypeListQuery,
  SaveDictDataReq,
  SaveDictTypeReq,
  SysDictDataResp,
  SysDictTypeResp,
  UpdateDictDataReq,
  UpdateDictTypeReq,
} from "../schemas/dict.js";

export class DictService {
  static async getDictTypeList(query: DictTypeListQuery) {
    const list = await SysDictModel.getDictTypeList(query);
    const total = await SysDictModel.getDictTypeTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getDictTypeById(id: number): Promise<SysDictTypeResp | null> {
    return await SysDictModel.getDictTypeById(id);
  }

  static async createDictType(req: SaveDictTypeReq): Promise<SysDictTypeResp> {
    const existing = await SysDictModel.getDictTypeByType(req.type);
    if (existing) {
      throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
    }
    return await SysDictModel.createDictType(req);
  }

  static async updateDictType(id: number, req: UpdateDictTypeReq): Promise<SysDictTypeResp> {
    const existing = await SysDictModel.getDictTypeById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_TYPE_NOT_FOUND, "字典类型不存在");
    if (req.type) {
      const conflict = await SysDictModel.getDictTypeByType(req.type);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
      }
    }
    return await SysDictModel.updateDictType(id, req);
  }

  static async deleteDictType(id: number): Promise<{ id: number }> {
    const res = await SysDictModel.deleteDictType(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_TYPE_DELETE_FORBIDDEN, "该字典类型下存在数据，禁止删除");
    return res;
  }

  static async getDictDataList(query: DictDataListQuery) {
    const list = await SysDictModel.getDictDataList(query);
    const total = await SysDictModel.getDictDataTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getDictDataById(id: number): Promise<SysDictDataResp | null> {
    return await SysDictModel.getDictDataById(id);
  }

  static async createDictData(req: SaveDictDataReq): Promise<SysDictDataResp> {
    const conflict = await SysDictModel.getDictDataByTypeAndValue(req.typeId, req.value);
    if (conflict) throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");
    return await SysDictModel.createDictData(req);
  }

  static async updateDictData(id: number, req: UpdateDictDataReq): Promise<SysDictDataResp> {
    const existing = await SysDictModel.getDictDataById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    if (req.value !== undefined && (req.typeId ?? existing.typeId) !== undefined) {
      const typeForCheck = req.typeId ?? existing.typeId;
      const conflict = await SysDictModel.getDictDataByTypeAndValue(typeForCheck, req.value);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");
      }
    }
    return await SysDictModel.updateDictData(id, req);
  }

  static async deleteDictData(id: number): Promise<{ id: number }> {
    const res = await SysDictModel.deleteDictData(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    return res;
  }
}