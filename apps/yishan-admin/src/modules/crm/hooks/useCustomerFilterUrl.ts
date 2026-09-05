/**
 * 客户筛选条件 ↔ URL search 双向绑定。
 *
 * 设计要点：
 * 1. URL 是单一真相源（刷新能恢复所有筛选 + 分页 + view）。
 * 2. 状态值统一走 string / number；空值不写 URL，避免 ?keyword=&page= 这种噪音。
 * 3. 随 location.search 重新解析，支持浏览器前进/后退。
 *
 * 用法：
 *   const { filters, pagination, view, setView, setFilter, setPagination, reset } =
 *     useCustomerFilterUrl()
 */

import { useLocation, useNavigate } from '@umijs/max';
import { useCallback, useEffect, useMemo } from 'react';
import type { CustomerListQuery } from '@/services/crm';
import {
  normalizeCustomerView,
  type SystemViewId,
} from '../utils/customerViewFilters';

const PAGE_PARAM_KEYS = ['page', 'pageSize'] as const;
const FILTER_PARAM_KEYS = [
  'keyword',
  'ownerUserId',
  'statusId',
  'sourceId',
  'level',
  'type',
  'industry',
  'province',
  'city',
  'collaboratorId',
  'tagIds',
  'createdFrom',
  'createdTo',
  'lastFollowUpFrom',
  'lastFollowUpTo',
  'nextFollowUpFrom',
  'nextFollowUpTo',
] as const satisfies ReadonlyArray<keyof CustomerListQuery>;

function readSearch(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

function hasValue(v: unknown): v is string | number {
  if (v === undefined || v === null || v === '') return false;
  return true;
}

export interface UseCustomerFilterUrlReturn {
  view: SystemViewId;
  filters: Partial<CustomerListQuery>;
  pagination: { page: number; pageSize: number };
  setView: (view: SystemViewId) => void;
  setFilter: <K extends keyof CustomerListQuery>(
    key: K,
    value: CustomerListQuery[K] | undefined,
  ) => void;
  setFilters: (patch: Partial<CustomerListQuery>) => void;
  setPagination: (patch: Partial<{ page: number; pageSize: number }>) => void;
  reset: () => void;
}

export function useCustomerFilterUrl(): UseCustomerFilterUrlReturn {
  const location = useLocation();
  const navigate = useNavigate();
  const search = readSearch(location.search);

  const view = useMemo<SystemViewId>(() => {
    const v = search.get('view') ?? undefined;
    return normalizeCustomerView(v);
  }, [search]);

  useEffect(() => {
    const next = readSearch(location.search);
    const rawView = next.get('view');
    if ((rawView && rawView !== view) || next.has('poolStatus')) {
      next.set('view', view);
      next.delete('poolStatus');
      next.delete('page');
      navigate(`${location.pathname}?${next}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate, view]);

  const pagination = useMemo(() => {
    const page = Number(search.get('page') ?? 1);
    const pageSize = Number(search.get('pageSize') ?? 10);
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    };
  }, [search]);

  const filters = useMemo<Partial<CustomerListQuery>>(() => {
    const out: Record<string, unknown> = {};
    for (const key of FILTER_PARAM_KEYS) {
      const raw = search.get(key);
      if (raw === null || raw === '') continue;
      if (key === 'tagIds') {
        out[key] = raw
          .split(',')
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n > 0);
        if ((out[key] as number[]).length === 0) delete out[key];
        continue;
      }
      if (
        key === 'ownerUserId' ||
        key === 'statusId' ||
        key === 'sourceId' ||
        key === 'collaboratorId'
      ) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) out[key] = n;
        continue;
      }
      out[key] = raw;
    }
    return out as Partial<CustomerListQuery>;
  }, [search]);

  const patchSearch = useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = readSearch(location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (!hasValue(v)) next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      navigate(qs ? `${location.pathname}?${qs}` : location.pathname, {
        replace: false,
      });
    },
    [location.pathname, location.search, navigate],
  );

  const setView = useCallback(
    (v: SystemViewId) => {
      patchSearch({ view: v, page: undefined });
    },
    [patchSearch],
  );

  const setFilter = useCallback(
    <K extends keyof CustomerListQuery>(
      key: K,
      value: CustomerListQuery[K] | undefined,
    ) => {
      const patch: Record<string, string | number | undefined> = {
        [key as string]: undefined,
      };
      if (Array.isArray(value)) {
        patch[key as string] = (value as unknown[]).join(',');
      } else if (hasValue(value)) {
        patch[key as string] = value as string | number;
      }
      patchSearch({ ...patch, page: undefined });
    },
    [patchSearch],
  );

  const setFilters = useCallback(
    (patch: Partial<CustomerListQuery>) => {
      const out: Record<string, string | number | undefined> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (Array.isArray(v)) out[k] = (v as unknown[]).join(',');
        else if (hasValue(v)) out[k] = v as string | number;
        else out[k] = undefined;
      }
      patchSearch({ ...out, page: undefined });
    },
    [patchSearch],
  );

  const setPagination = useCallback(
    (patch: Partial<{ page: number; pageSize: number }>) => {
      const out: Record<string, number | undefined> = {};
      for (const key of PAGE_PARAM_KEYS) {
        if (patch[key] !== undefined) out[key] = patch[key];
      }
      patchSearch(out);
    },
    [patchSearch],
  );

  const reset = useCallback(() => {
    const cleared: Record<string, undefined> = {};
    for (const k of FILTER_PARAM_KEYS) cleared[k as string] = undefined;
    patchSearch({
      view: undefined,
      page: undefined,
      pageSize: undefined,
      ...cleared,
    });
  }, [patchSearch]);

  return {
    view,
    filters,
    pagination,
    setView,
    setFilter,
    setFilters,
    setPagination,
    reset,
  };
}
