/**
 * 横向阶段管道。
 *
 * 6 个系统阶段的固定映射：
 *   pending    → 发现需求
 *   contacted  → 确认需求
 *   qualified  → 解决方案
 *   proposal   → 商务谈判
 *   won        → 成交
 *   lost       → 流失
 *
 * 当前阶段高亮蓝色 token，其余灰色。
 * 当前阶段下方显示"阶段停留 N 天" —— 基于 lastFollowUpAt 或 createdAt 兜底。
 */

import { CheckOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { StatusRow } from '@/services/crm';

const STATUS_DISPLAY: Record<string, string> = {
  pending: '发现需求',
  contacted: '确认需求',
  qualified: '解决方案',
  proposal: '商务谈判',
  won: '成交',
  lost: '流失',
};

const ACTIVE_COLOR = '#1677ff';
const INACTIVE_COLOR = '#bfbfbf';
const ACTIVE_BG = '#e6f4ff';
const INACTIVE_BG = '#fafafa';

export interface CustomerStagePipelineProps {
  statuses: StatusRow[];
  currentStatusId: number | null;
  currentStatusCode: string | null;
  currentStatusName: string | null;
  /** 阶段进入时间；缺省时用 lastFollowUpAt → createdAt 兜底。 */
  stageEnteredAt?: string | null;
  /** 创建时间兜底。 */
  createdAt?: string | null;
}

function stageLabel(
  code: string | null,
  fallback: string | null,
): string {
  if (code && STATUS_DISPLAY[code]) return STATUS_DISPLAY[code];
  return fallback ?? code ?? '—';
}

function computeStageDays(
  stageEnteredAt: string | null | undefined,
  createdAt: string | null | undefined,
): number {
  const source = stageEnteredAt ?? createdAt ?? null;
  if (!source) return 0;
  const d = dayjs(source);
  if (!d.isValid()) return 0;
  const diff = dayjs().startOf('day').diff(d.startOf('day'), 'day');
  return diff < 0 ? 0 : diff;
}

const CustomerStagePipeline: React.FC<CustomerStagePipelineProps> = ({
  statuses,
  currentStatusId,
  currentStatusCode,
  currentStatusName: _currentStatusName,
  stageEnteredAt,
  createdAt,
}) => {
  // 只取系统状态 / 客户阶段类型（type='customer' 或 isSystem=1）
  const stages = React.useMemo(() => {
    const filtered = statuses
      .filter((s) => s.enabled === 1)
      .sort((a, b) => a.sort - b.sort);
    // 如果系统阶段都在就用它们；否则回退到 filtered 全集
    const systemOnes = filtered.filter(
      (s) => s.code && STATUS_DISPLAY[s.code],
    );
    return systemOnes.length > 0 ? systemOnes : filtered;
  }, [statuses]);

  const activeIndex = React.useMemo(() => {
    if (currentStatusId !== null) {
      const idx = stages.findIndex((s) => s.id === currentStatusId);
      if (idx >= 0) return idx;
    }
    if (currentStatusCode) {
      const idx = stages.findIndex((s) => s.code === currentStatusCode);
      if (idx >= 0) return idx;
    }
    return -1;
  }, [stages, currentStatusId, currentStatusCode]);

  const days = computeStageDays(stageEnteredAt, createdAt);

  if (stages.length === 0) {
    return (
      <div style={{ color: '#bfbfbf', fontSize: 12 }}>暂无阶段数据</div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
        }}
      >
        {stages.map((s, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = idx < activeIndex;
          const isLast = idx === stages.length - 1;
          const dotBg = isActive
            ? ACTIVE_COLOR
            : isPassed
              ? ACTIVE_COLOR
              : '#ffffff';
          const dotBorder = isActive || isPassed ? ACTIVE_COLOR : INACTIVE_COLOR;
          const labelColor = isActive ? ACTIVE_COLOR : isPassed ? '#262626' : INACTIVE_COLOR;
          const cellBg = isActive ? ACTIVE_BG : INACTIVE_BG;
          const connector = isPassed
            ? ACTIVE_COLOR
            : idx === activeIndex
              ? `linear-gradient(to right, ${ACTIVE_COLOR} 0%, ${INACTIVE_COLOR} 100%)`
              : '#f0f0f0';

          return (
            <React.Fragment key={s.id}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 4px',
                  background: cellBg,
                  borderRadius: 6,
                  position: 'relative',
                  minWidth: 0,
                }}
                title={s.name}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: dotBg,
                    border: `2px solid ${dotBorder}`,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                  }}
                >
                  {isPassed ? <CheckOutlined /> : null}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: labelColor,
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {stageLabel(s.code ?? null, s.name)}
                </div>
              </div>
              {!isLast && (
                <Tooltip title="" destroyTooltipOnHide>
                  <div
                    style={{
                      width: 18,
                      height: 2,
                      background: connector,
                      flexShrink: 0,
                    }}
                  />
                </Tooltip>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {activeIndex >= 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#595959',
          }}
        >
          当前阶段：
          <span style={{ color: ACTIVE_COLOR, fontWeight: 600 }}>
            {stageLabel(
              stages[activeIndex].code ?? null,
              stages[activeIndex].name,
            )}
          </span>
          <span style={{ marginLeft: 12, color: '#8c8c8c' }}>
            阶段停留 {days} 天
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomerStagePipeline;
