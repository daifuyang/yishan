import type { FastifyInstance } from "fastify";
import { DictRepository, CreateDictTypeInput, UpdateDictTypeInput, CreateDictDataInput, UpdateDictDataInput } from "../repositories/dict.repository.js";
import { DictMapper } from "../mappers/dict.mapper.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { DictErrorCode } from "../../constants/business-codes/dict.js";
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
import { CACHE_CONFIG } from "../../config/index.js";

export class DictService {
  private static readonly CACHE_KEY = 'dict:data:map';
  private static readonly CACHE_TTL = CACHE_CONFIG.defaultTTLSeconds;

  static async getDictTypeList(query: DictTypeListQuery) {
    const list = await DictRepository.listTypes({
      ...query,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
    const total = await DictRepository.countTypes({
      keyword: query.keyword,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
    return { 
      list: list.map(DictMapper.toDictTypeListResp), 
      total, 
      page: query.page || 1, 
      pageSize: query.pageSize || 10 
    };
  }

  static async getDictTypeById(id: number): Promise<SysDictTypeResp | null> {
    const dictType = await DictRepository.findTypeById(id);
    return dictType ? DictMapper.toDictTypeDetailResp(dictType) : null;
  }

  static async createDictType(req: SaveDictTypeReq, operatorId: number | any = 1, fastify?: FastifyInstance): Promise<SysDictTypeResp> {
    const resolvedOperatorId = typeof operatorId === "number" ? operatorId : 1;
    const existing = await DictRepository.findTypeByType(req.type);
    if (existing) {
      throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
    }

    const input: CreateDictTypeInput = {
      name: req.name,
      type: req.type,
      status: req.status ?? 1,
      sortOrder: req.sort_order ?? 0,
      remark: req.remark,
      creatorId: resolvedOperatorId,
      updaterId: resolvedOperatorId,
    };

    const result = await DictRepository.createType(input);
    await this.clearDictDataMapCache(fastify);
    return DictMapper.toDictTypeDetailResp(result);
  }

  static async updateDictType(id: number, req: UpdateDictTypeReq, operatorId: number | any = 1, fastify?: FastifyInstance): Promise<SysDictTypeResp> {
    const resolvedOperatorId = typeof operatorId === "number" ? operatorId : 1;
    const existing = await DictRepository.findTypeById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_TYPE_NOT_FOUND, "字典类型不存在");
    
    if (req.type) {
      const conflict = await DictRepository.findTypeByType(req.type);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_TYPE_ALREADY_EXISTS, "字典类型已存在");
      }
    }

    const input: UpdateDictTypeInput = {
      updaterId: resolvedOperatorId,
    };
    if (req.name !== undefined) input.name = req.name;
    if (req.type !== undefined) input.type = req.type;
    if (req.status !== undefined) input.status = req.status;
    if (req.sort_order !== undefined) input.sortOrder = req.sort_order;
    if (req.remark !== undefined) input.remark = req.remark;

    const result = await DictRepository.updateType(id, input);
    await this.clearDictDataMapCache(fastify);
    return DictMapper.toDictTypeDetailResp(result);
  }

  static async deleteDictType(id: number, fastify?: FastifyInstance): Promise<{ id: number } | null> {
    const res = await DictRepository.softDeleteType(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_TYPE_DELETE_FORBIDDEN, "该字典类型下存在数据，禁止删除");
    await this.clearDictDataMapCache(fastify);
    return res;
  }

  static async getDictDataList(query: DictDataListQuery) {
    let resolvedTypeId: number | undefined = query.typeId;
    if (query.type && !query.typeId) {
      const type = await DictRepository.findTypeByType(query.type);
      resolvedTypeId = type?.id;
    }

    const list = await DictRepository.listData({
      ...query,
      typeId: resolvedTypeId,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
    const total = await DictRepository.countData({
      typeId: resolvedTypeId,
      keyword: query.keyword,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
    return { 
      list: list.map(DictMapper.toDictDataListResp), 
      total, 
      page: query.page || 1, 
      pageSize: query.pageSize || 10 
    };
  }

  static async getDictDataById(id: number): Promise<SysDictDataResp | null> {
    const dictData = await DictRepository.findDataById(id);
    return dictData ? DictMapper.toDictDataDetailResp(dictData) : null;
  }

  static async createDictData(req: SaveDictDataReq, operatorId: number | any = 1, fastify?: FastifyInstance): Promise<SysDictDataResp> {
    const resolvedOperatorId = typeof operatorId === "number" ? operatorId : 1;
    const conflict = await DictRepository.findDataByTypeAndValue(req.typeId, req.value);
    if (conflict) throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");

    const input: CreateDictDataInput = {
      typeId: req.typeId,
      label: req.label,
      value: req.value,
      status: req.status ?? 1,
      sortOrder: req.sort_order ?? 0,
      tag: req.tag,
      remark: req.remark,
      isDefault: req.isDefault ?? false,
      creatorId: resolvedOperatorId,
      updaterId: resolvedOperatorId,
    };

    const result = await DictRepository.createData(input);
    await this.clearDictDataMapCache(fastify);
    return DictMapper.toDictDataDetailResp(result);
  }

  static async updateDictData(id: number, req: UpdateDictDataReq, operatorId: number | any = 1, fastify?: FastifyInstance): Promise<SysDictDataResp> {
    const resolvedOperatorId = typeof operatorId === "number" ? operatorId : 1;
    const existing = await DictRepository.findDataById(id);
    if (!existing) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    
    if (req.value !== undefined && (req.typeId ?? existing.typeId) !== undefined) {
      const typeForCheck = req.typeId ?? existing.typeId;
      const conflict = await DictRepository.findDataByTypeAndValue(typeForCheck, req.value);
      if (conflict && conflict.id !== id) {
        throw new BusinessError(DictErrorCode.DICT_DATA_ALREADY_EXISTS, "字典数据已存在");
      }
    }

    const input: UpdateDictDataInput = {
      updaterId: resolvedOperatorId,
    };
    if (req.typeId !== undefined) input.typeId = req.typeId;
    if (req.label !== undefined) input.label = req.label;
    if (req.value !== undefined) input.value = req.value;
    if (req.status !== undefined) input.status = req.status;
    if (req.sort_order !== undefined) input.sortOrder = req.sort_order;
    if (req.tag !== undefined) input.tag = req.tag;
    if (req.remark !== undefined) input.remark = req.remark;
    if (req.isDefault !== undefined) input.isDefault = req.isDefault;

    const result = await DictRepository.updateData(id, input);
    await this.clearDictDataMapCache(fastify);
    return DictMapper.toDictDataDetailResp(result);
  }

  static async deleteDictData(id: number, fastify?: FastifyInstance): Promise<{ id: number } | null> {
    const res = await DictRepository.softDeleteData(id);
    if (!res) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
    await this.clearDictDataMapCache(fastify);
    return res;
  }

  static async getAllDictDataMap(fastify?: FastifyInstance): Promise<Record<string, { label: string; value: string }[]>> {
    if (fastify?.redis) {
      try {
        const cached = await fastify.redis.get(this.CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        fastify.log.warn(`Redis缓存获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result = await DictRepository.getAllDictDataMap();

    if (fastify?.redis) {
      try {
        await fastify.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(result));
      } catch (error) {
        fastify.log.warn(`Redis缓存设置失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  private static async clearDictDataMapCache(fastify?: FastifyInstance): Promise<void> {
    if (fastify?.redis) {
      try {
        await fastify.redis.del(this.CACHE_KEY);
      } catch (error) {
        fastify.log.warn(`Redis缓存清除失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
