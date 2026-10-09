/**
 * 地区管理列表页。
 *
 * 数据源：`GET /api/v1/admin/system/regions/tree?level=3`
 *   - 后端是只读字典表，没有分页/搜索端点
 *   - 数据天然有省→市→区三层嵌套关系，本页面用嵌套 ProTable 渲染
 *     （可点击展开下一级），比扁平 ~3400 行更易读
 *
 * 表格行为：
 *   - 默认展开全部 31 省（首屏即可看到所有省级入口）
 *   - 不分页（树形 ProTable + 全数据 ~31 根已经在内存中）
 *   - 搜索作用于整棵树：匹配 code 或 name 时连带展开该路径
 *
 * 严格只读：CRUD、启停、删除一律不做，符合后端只读设计；
 * 数据修正需要重新运行 `pnpm --filter yishan-api db:seed` 重灌。
 */
import { PageContainer, type ProColumns, ProTable } from '@ant-design/pro-components';
import React, { useEffect, useMemo, useState } from 'react';
import { getSystemRegionTree } from '@/services/generated/systemRegions';

/** 后端返回的树节点，children 由 Cascader / 本表格递归渲染。 */
type RegionTreeNode = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  children?: RegionTreeNode[];
};

const LEVEL_VALUE_ENUM: Record<number, { text: string; status: 'Success' | 'Processing' | 'Default' }> = {
  1: { text: '省', status: 'Success' },
  2: { text: '市', status: 'Processing' },
  3: { text: '区/县', status: 'Default' },
};

const RegionList: React.FC = () => {
  const [tree, setTree] = useState<RegionTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getSystemRegionTree({ level: 3 });
        if (cancelled) return;
        const data = (res as { success?: boolean; data?: RegionTreeNode[] }).data;
        setTree(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) {
          setLoadError('地区数据加载失败：响应结构异常');
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '地区数据加载异常');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo<ProColumns<RegionTreeNode>[]>(
    () => [
      { title: '代码', dataIndex: 'code', width: 110, valueType: 'digit' },
      { title: '名称', dataIndex: 'name', width: 220 },
      {
        title: '级别',
        dataIndex: 'level',
        width: 100,
        valueEnum: LEVEL_VALUE_ENUM,
      },
      { title: '上级代码', dataIndex: 'parentCode', width: 110, search: false },
      { title: '排序', dataIndex: 'sortOrder', width: 90, search: false },
    ],
    [],
  );

  // 默认展开所有省级（31 个），便于一眼看到全量顶级入口
  const defaultExpand = useMemo(() => tree.map((n) => n.code), [tree]);

  return (
    <PageContainer>
      <ProTable<RegionTreeNode>
        headerTitle="地区列表"
        rowKey="code"
        loading={loading}
        dataSource={tree}
        columns={columns}
        search={{ labelWidth: 100 }}
        pagination={false}
        expandable={{
          defaultExpandAllRows: false,
          defaultExpandedRowKeys: defaultExpand,
          indentSize: 20,
          rowExpandable: (record) => Array.isArray(record.children) && record.children.length > 0,
        }}
        scroll={{ x: 720 }}
        toolBarRender={() =>
          loadError
            ? [<span key="err" style={{ color: '#ff4d4f' }}>{loadError}</span>]
            : []
        }
      />
    </PageContainer>
  );
};

export default RegionList;
