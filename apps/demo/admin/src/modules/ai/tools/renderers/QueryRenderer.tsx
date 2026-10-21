import { Button, Flex, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { ToolCallCard } from '../components/ToolCallCard';
import { COLUMN_LABELS, ENUM_LABELS } from '../labels';
import type { QueryColumn, ToolRendererProps } from '../model';
import { formatValue, record, safeValue, text } from '../safe-data';

type QueryRecord = Record<string, unknown>;

const RESERVED_KEYS = ['__proto__', 'prototype', 'constructor'];
const PAGE_SIZE = 10;

function renderValue(value: unknown, format?: QueryColumn['format']) {
  if (!format) return formatValue(value);
  const label = ENUM_LABELS[format]?.[String(value)] ?? formatValue(value);
  if (format !== 'status') return label;
  return (
    <Tag
      color={
        value === 1 || value === '1'
          ? 'green'
          : value === 2 || value === '2'
            ? 'orange'
            : 'default'
      }
    >
      {label}
    </Tag>
  );
}

/**
 * 列的来源有两条：服务端声明了就用服务端的，没声明就从数据行里推。
 *
 * 推出来的列名是原始字段名 —— 新增一个业务查询工具**不需要**在前端补一份列配置，
 * 这是「不加 Renderer 也能用」的关键。
 */
function queryColumns(value: unknown, rows: QueryRecord[]): QueryColumn[] {
  const columns: QueryColumn[] = [];
  const keys = new Set<string>();
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const column = record(candidate);
      const key = text(column.key);
      if (!key || RESERVED_KEYS.includes(key) || keys.has(key)) continue;
      keys.add(key);
      columns.push({
        key,
        label: text(column.label) || key,
        format:
          column.format === 'status' ||
          column.format === 'gender' ||
          column.format === 'scope'
            ? column.format
            : undefined,
      });
    }
  }
  if (columns.length) return columns;
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (RESERVED_KEYS.includes(key) || keys.has(key)) continue;
      keys.add(key);
      columns.push({ key, label: COLUMN_LABELS[key] ?? key });
    }
  }
  return columns;
}

/**
 * 单条记录的只读展示。
 *
 * 刻意**不用** antd 的 Descriptions：它渲染成 `<table>`，会让「单条记录」和
 * 「结果表格」在 DOM 上无法区分。
 */
function RecordFields({
  record: data,
  columns,
}: {
  record: QueryRecord;
  columns: QueryColumn[];
}) {
  return (
    <div>
      {columns.map((column) => (
        <div
          key={column.key}
          style={{ display: 'flex', gap: 12, paddingBlock: 4, minWidth: 0 }}
        >
          <Typography.Text
            type="secondary"
            style={{ flex: '0 0 120px', overflowWrap: 'anywhere' }}
          >
            {column.label}
          </Typography.Text>
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {renderValue(data[column.key], column.format)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 结果表格。
 *
 * 用**原生 table**而不是 antd Table：查询结果的列是运行时才知道的，antd Table 的
 * 固定列/虚拟滚动在这里都用不上，而它自带的滚动条测量在无头环境里会直接抛错。
 */
function ResultTable({
  rows,
  columns,
}: {
  rows: QueryRecord[];
  columns: QueryColumn[];
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows
    .slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
    .map((row, position) => ({
      // 行键优先用业务主键；没有主键时用「页码 + 行号」，保证同一页内稳定。
      key: String(row.id ?? row.key ?? `${current}-${position}`),
      row,
    }));
  return (
    <Flex vertical gap={8} style={{ minWidth: 0 }}>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    textAlign: 'start',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--ant-color-border-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ key, row }) => (
              <tr key={key}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--ant-color-split)',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {renderValue(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <Flex gap={4} align="center">
          {Array.from({ length: pages }, (_, index) => index + 1).map((value) => (
            <Button
              key={value}
              size="small"
              type={value === current ? 'primary' : 'default'}
              title={String(value)}
              onClick={() => setPage(value)}
            >
              {value}
            </Button>
          ))}
        </Flex>
      )}
    </Flex>
  );
}

/**
 * 查询结果的展示。
 *
 * 它同时处理四种结果形状：记录数组、单个对象、空结果、异常结构。
 * 异常结构不会被当成「有数据」——宁可显示「未找到符合条件的结果」，也不把半截数据
 * 渲染成一张看起来正常的表。
 */
export function QueryRenderer({ tool }: ToolRendererProps) {
  if (tool.presentation.type !== 'query') return <ToolCallCard tool={tool} />;
  const data = record(tool.presentation.data);
  const rows = Array.isArray(data.rows)
    ? data.rows
        .map((row) => record(safeValue(row)))
        .filter((row) => Object.keys(row).length > 0)
    : [];
  const detail = record(safeValue(data.record));
  const hasDetail = Object.keys(detail).length > 0;
  const columns = queryColumns(data.columns, hasDetail ? [detail] : rows);
  const notice = text(data.notice);
  if (!rows.length && !hasDetail) {
    return (
      <ToolCallCard
        tool={{
          ...tool,
          empty: true,
          resultSummary: notice || '未找到符合条件的结果',
        }}
      />
    );
  }
  const total =
    typeof data.total === 'number' &&
    Number.isSafeInteger(data.total) &&
    data.total >= rows.length
      ? data.total
      : rows.length;
  return (
    <ToolCallCard tool={tool} defaultExpanded={false}>
      {hasDetail ? (
        <RecordFields record={detail} columns={columns} />
      ) : (
        <>
          <Typography.Text type="secondary">
            共 {total} 条，已加载 {rows.length} 条
          </Typography.Text>
          <ResultTable rows={rows} columns={columns} />
        </>
      )}
      {notice && <Typography.Paragraph type="secondary">{notice}</Typography.Paragraph>}
      {data.truncated === true && (
        <Typography.Paragraph type="secondary">
          结果过多已截断，可以补充关键词或状态再查一次。
        </Typography.Paragraph>
      )}
    </ToolCallCard>
  );
}
