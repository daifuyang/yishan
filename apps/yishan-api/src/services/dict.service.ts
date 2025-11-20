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
import { CACHE_CONFIG } from "../config/index.js";

export class DictService {
  private static readonly CACHE_KEY = 'dict:data:map';
  private static readonly CACHE_TTL = CACHE_CONFIG.defaultTTLSeconds;

  static async getDictTypeList(query: DictTypeListQuery) {
    const list = await SysDictModel.getDictTypeList(query);
    const total = await SysDictModel.getDictTypeTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getDictTypeById(id: number): Promise<SysDictTypeResp | null> {
    return await SysDictModel.getDictTypeById(id);
  }

  static async createDictType(req: SaveDictTypeReq, fastify?: any): Promise<SysDictTypeResp> {
    const existing = await SysDictModel.getDictTypeByType(req.type);
    if (existing) {
      throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
    }
    const result = await SysDictModel.createDictType(req);
    // 清除缓存（新增字典类型可能影响字典数据映射）
    await this.clearDictDataMapCache(fastify);
    return result;
  }

  static async updateDictType(id: number, req: UpdateDictTypeReq, fastify?: any): Promise<SysDictTypeResp> {
    const existing = await SysDictModel.getDictTypeById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_TYPE_NOT_FOUND, "字典类型不存在");
    if (req.type) {
      const conflict = await SysDictModel.getDictTypeByType(req.type);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
      }
    }
    const result = await SysDictModel.updateDictType(id, req);
    // 清除缓存（更新字典类型可能影响字典数据映射）
    await this.clearDictDataMapCache(fastify);
    return result;
  }

  static async deleteDictType(id: number, fastify?: any): Promise<{ id: number } | null> {
    const res = await SysDictModel.deleteDictType(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_TYPE_DELETE_FORBIDDEN, "该字典类型下存在数据，禁止删除");
    // 清除缓存（删除字典类型可能影响字典数据映射）
    await this.clearDictDataMapCache(fastify);
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

  static async createDictData(req: SaveDictDataReq, fastify?: any): Promise<SysDictDataResp> {
    const conflict = await SysDictModel.getDictDataByTypeAndValue(req.typeId, req.value);
    if (conflict) throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");
    const result = await SysDictModel.createDictData(req);
    // 清除缓存
    await this.clearDictDataMapCache(fastify);
    return result;
  }

  static async updateDictData(id: number, req: UpdateDictDataReq, fastify?: any): Promise<SysDictDataResp> {
    const existing = await SysDictModel.getDictDataById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    if (req.value !== undefined && (req.typeId ?? existing.typeId) !== undefined) {
      const typeForCheck = req.typeId ?? existing.typeId;
      const conflict = await SysDictModel.getDictDataByTypeAndValue(typeForCheck, req.value);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");
      }
    }
    const result = await SysDictModel.updateDictData(id, req);
    // 清除缓存
    await this.clearDictDataMapCache(fastify);
    return result;
  }

  static async deleteDictData(id: number, fastify?: any): Promise<{ id: number } | null> {
    const res = await SysDictModel.deleteDictData(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    // 清除缓存
    await this.clearDictDataMapCache(fastify);
    return res;
  }

  static async getAllDictDataMap(fastify?: any): Promise<Record<string, { label: string; value: string }[]>> {
    // 如果提供了fastify实例，尝试使用缓存
    if (fastify?.redis) {
      try {
        // 从缓存获取
        const cached = await fastify.redis.get(this.CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        // 缓存失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 从数据库获取数据
    const result = await SysDictModel.getAllDictDataMap();

    // 如果提供了fastify实例，将结果存入缓存
    if (fastify?.redis) {
      try {
        await fastify.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(result));
      } catch (error) {
        // 缓存失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存设置失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  /**
   * 清除字典数据映射缓存
   */
  private static async clearDictDataMapCache(fastify?: any): Promise<void> {
    if (fastify?.redis) {
      try {
        await fastify.redis.del(this.CACHE_KEY);
      } catch (error) {
        // 缓存清除失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存清除失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}