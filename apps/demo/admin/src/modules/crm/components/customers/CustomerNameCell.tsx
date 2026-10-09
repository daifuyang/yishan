import { Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

/**
 * 客户类型 → 展示文案。
 *
 * 视觉定位：分类属性（非业务状态），与"客户状态"Tag 区分；
 * 用轻量中性 Label 表达，避免与状态/等级争夺视觉注意力。
 *
 * 枚举来源：apps/yishan-api/src/modules/crm/repositories/customer.repository.ts
 *   CustomerType = 'enterprise' | 'individual'
 * 后续若后端新增 channel / partner 等类型，按需在此扩展，**不要**为本次 UI 改动新增数据库枚举。
 */
const TYPE_LABEL: Record<string, string> = {
  enterprise: '企业客户',
  individual: '个人客户',
};

const useStyles = createStyles(({ token }) => ({
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
    maxWidth: '100%',
    rowGap: 4,
  },
  name: {
    display: 'block',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '22px',
    color: token.colorPrimary,
    cursor: 'pointer',
    '&:hover': { color: token.colorPrimaryHover, textDecoration: 'none' },
    '&:focus-visible': {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
  },
  // 轻量中性 Label：浅灰背景 + 中性灰文字 + 圆角小 + 紧贴名称下方。
  // 不使用高饱和色、不使用明显边框/阴影，避免与客户状态/等级 Badge 抢眼。
  typeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 20,
    padding: '0 6px',
    fontSize: 12,
    lineHeight: '18px',
    borderRadius: token.borderRadiusSM,
    background: token.colorFillSecondary,
    color: token.colorTextSecondary,
    whiteSpace: 'nowrap',
  },
}));

interface CustomerNameCellProps {
  id: number;
  name: string;
  type: string;
  onOpenDetail: (id: number) => void;
}

export default function CustomerNameCell({
  id,
  name,
  type,
  onOpenDetail,
}: CustomerNameCellProps) {
  const { styles, cx } = useStyles();
  // 命中映射才显示；空类型 / 未识别类型都不渲染，避免制造无价值信息。
  const typeLabel = type ? TYPE_LABEL[type] : null;
  return (
    <div className={cx('customer-name-cell', styles.cell)}>
      <Tooltip title={name}>
        <a
          role="link"
          tabIndex={0}
          className={styles.name}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetail(id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              onOpenDetail(id);
            }
          }}
        >
          {name}
        </a>
      </Tooltip>
      {typeLabel && <span className={styles.typeLabel}>{typeLabel}</span>}
    </div>
  );
}
