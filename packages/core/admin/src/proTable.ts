/**
 * ProTable request adapter —— 把后端 list API 的统一信封
 * `{ success, code, message, data, pagination }` 翻译成 ProTable 的
 * `{ data, success, total }`。
 *
 * 单一职责：只做信封解包。Page → API 的参数映射（`current` → `page`、
 * 字段命名差异等）由调用方负责，避免适配器暗示后端契约。
 *
 * 边界：
 * - 调用方抛出的错误 / 失败状态原样上抛，不吞。
 * - 缺失 `pagination` 时 `total` 走 0（不能用 data.length 假装，
 *   否则 ProTable 会以为一页已经全部返回，触发错误分页）。
 * - 缺失 `data` 时返回空数组而非 undefined，避免 ProTable 判空失败。
 *
 * 与 `requestErrorConfig.ts` 的信封展示配合：业务错误在 errorHandler
 * 阶段已经触发 message，本适配器只关心成功信封的成功路径。
 */

/** 后端 list 接口的统一响应信封（与 `requestErrorConfig.ts` 中一致）。 */
export interface ApiListEnvelope<T> {
  success?: boolean;
  code?: number;
  message?: string;
  data?: T[];
  pagination?: { total: number; page?: number; pageSize?: number };
}

/** ProTable `request` 回调的返回值形状。 */
export interface ProTableRequestResult<T> {
  data: T[];
  success: boolean;
  total: number;
}

/**
 * 包装一个 list fetcher 为 ProTable 兼容的 request 回调。
 *
 * @param fetcher 接收任意参数，返回 `ApiListEnvelope<T>` 的 API 调用。
 *                一般来自 `services/generated/*` 的 `getXxxList`。
 *
 * @example
 *   const request = createProTableRequest<MyParams, MyItem>((p) => getMyList(p));
 *   <ProTable request={request} ... />
 */
export function createProTableRequest<TParams, TItem>(
  fetcher: (params: TParams) => Promise<ApiListEnvelope<TItem>>,
): (params: TParams) => Promise<ProTableRequestResult<TItem>> {
  return async (params) => {
    const result = await fetcher(params);
    return {
      data: result.data ?? [],
      success: result.success ?? true,
      total: result.pagination?.total ?? 0,
    };
  };
}
