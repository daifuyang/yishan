/**
 * ProForm 行政区划级联选择组件。
 *
 * 实现说明：
 *   - 用原生 antd Form.Item + Cascader 包一层；不走 ProFormCascader，因为它走
 *     request-SWR-options 路径，懒加载场景下追加子级无法触发 re-render。
 *
 *   - 后端返回 {code, name, ...}；Cascader 默认找 label/value/children 三个字段。
 *     我们在内部做 name→label、code→value 的转换，并通过 fieldNames 显式指定
 *     字段名。
 *
 * 设计：
 *   - default（loadAll=false）：首屏只拉 31 省；展开下级调 listSystemRegions({parentCode})
 *   - loadAll=true：一次拉整树 ~3400 条
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Cascader, Form, type CascaderProps } from 'antd';
import {
  getSystemRegionTree,
  listSystemRegions,
} from '@/services/generated/systemRegions';

/** 后端原始节点 */
type RegionNode = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  children?: RegionNode[];
};

/** Cascader 期望的 (label, value, children) 节点 */
type CascaderOption = {
  code: number;
  label: string;
  value: number;
  level: number;
  parentCode: number;
  children?: CascaderOption[];
  isLeaf?: boolean;
};

const FIELD_NAMES = {
  label: 'label' as const,
  value: 'value' as const,
  children: 'children' as const,
};

/** 后端节点 → Cascader 期望节点 */
function toCascaderOption(node: RegionNode): CascaderOption {
  const hasLoadedChildren = Array.isArray(node.children) && node.children.length > 0;
  const isLeaf = node.level >= 3;
  return {
    code: node.code,
    value: node.code,
    label: node.name,
    level: node.level,
    parentCode: node.parentCode,
    isLeaf,
    children: isLeaf
      ? undefined
      : hasLoadedChildren
        ? (node.children as RegionNode[]).map(toCascaderOption)
        : [],
  };
}

export interface ProFormRegionCascaderProps {
  name: string | (string | number)[];
  label?: React.ReactNode;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  /** 加载策略：false（默认）= 懒加载；true = 一次拉整树 */
  loadAll?: boolean;
  /** Form.Item 的 extra 说明文本 */
  extra?: React.ReactNode;
  /** cascader 自身配置（只能覆盖，不含 options/loadData/fieldNames/onChange/value） */
  fieldProps?: Omit<
    CascaderProps,
    'options' | 'loadData' | 'fieldNames' | 'onChange' | 'value' | 'children'
  >;
}

/**
 * ProForm 行政区划级联选择组件。
 *
 * 在父 ProForm/Form 上下文中：通过 Form.Item 自动注入 value/onChange。
 * 本组件内部维护整棵树（tree state），懒加载时 mutate 节点 children 并 setTree。
 */
export const ProFormRegionCascader: React.FC<ProFormRegionCascaderProps> = ({
  name,
  label = '省/市/区',
  placeholder = '请选择省/市/区',
  allowClear = true,
  disabled,
  loadAll = false,
  extra,
  fieldProps,
}) => {
  const [tree, setTree] = useState<CascaderOption[]>([]);

  // 首屏拉数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = loadAll
          ? ((await getSystemRegionTree({ level: 3 })) as { data?: RegionNode[] }).data ?? []
          : ((await listSystemRegions({ parentCode: 0 })) as { data?: RegionNode[] }).data ?? [];
        if (!cancelled) setTree(raw.map(toCascaderOption));
      } catch (err) {
        if (!cancelled) {
          console.error(loadAll ? '获取省市区整树失败:' : '获取省级列表失败:', err);
          setTree([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  // 懒加载：cascader 触发 loadData(selectedOptions)；我们把 children 填入对应节点
  // Cascader 的 loadData 签名是 (selectedOptions) => void，所以这里 fire-and-forget：
  // 内部 .then()/.catch() 不阻塞 cascader；state 更新后 cascader 自动 re-render。
  const handleLoadData = useCallback(
    (selectedOptions?: CascaderOption[]) => {
      if (loadAll || !selectedOptions) return;
      const last = selectedOptions[selectedOptions.length - 1];
      if (!last) return;
      void (async () => {
        try {
          const res = (await listSystemRegions({ parentCode: last.code })) as {
            data?: RegionNode[];
          };
          const raw = res.data ?? [];
          const updateNode = (nodes: CascaderOption[]): CascaderOption[] =>
            nodes.map((n) => {
              if (n.value === last.value) {
                return { ...n, children: raw.map(toCascaderOption) };
              }
              if (n.children?.length) {
                const next = updateNode(n.children);
                return next === n.children ? n : { ...n, children: next };
              }
              return n;
            });
          setTree((prev) => updateNode(prev));
        } catch (err) {
          console.error('获取下级行政区划失败:', err);
        }
      })();
    },
    [loadAll],
  );

  return (
    <Form.Item name={name} label={label} extra={extra}>
      <Cascader
        options={tree}
        placeholder={placeholder}
        allowClear={allowClear}
        disabled={disabled}
        fieldNames={FIELD_NAMES}
        loadData={loadAll ? undefined : (handleLoadData as unknown as CascaderProps['loadData'])}
        showSearch
        changeOnSelect={false}
        multiple={false}
        {...(fieldProps as Record<string, unknown>)}
      />
    </Form.Item>
  );
};

export default ProFormRegionCascader;
