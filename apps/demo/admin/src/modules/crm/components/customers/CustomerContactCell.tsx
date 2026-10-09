import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef, useState } from 'react';
import { formatPhone } from '../../utils/formatPhone';

const useStyles = createStyles(({ token }) => ({
  cell: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    '&:hover .copy-phone-button, &:focus-within .copy-phone-button': {
      opacity: 1,
    },
  },
  name: {
    color: token.colorText,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '22px',
  },
  phoneRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    height: 18,
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  phone: {
    color: token.colorTextSecondary,
    fontSize: 12,
    lineHeight: '18px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  copy: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 28px',
    width: 28,
    height: 28,
    marginBlock: -5,
    padding: 0,
    border: 0,
    borderRadius: 4,
    background: 'transparent',
    color: token.colorTextTertiary,
    fontSize: 14,
    cursor: 'pointer',
    opacity: 0,
    transition:
      'opacity 140ms ease, color 140ms ease, background-color 140ms ease',
    '&:hover': {
      color: token.colorPrimary,
      background: token.colorFillTertiary,
    },
    '&:focus-visible': {
      opacity: 1,
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    '&[data-copied="true"]': { opacity: 1, color: token.colorSuccess },
    '@media (hover: none), (pointer: coarse)': { opacity: 1 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
}));

interface CustomerContactCellProps {
  name: string;
  /** Only pass the value the current user is allowed to see. */
  phone?: string | null;
}

export default function CustomerContactCell({
  name,
  phone,
}: CustomerContactCellProps) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);
  const copying = useRef(false);

  useEffect(() => {
    setCopiedPhone(null);
    copying.current = false;
    return () => {
      version.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [phone]);

  const copyPhone = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!phone?.trim() || copying.current) return;
    const requestVersion = version.current;
    copying.current = true;
    try {
      await navigator.clipboard.writeText(phone);
      if (version.current !== requestVersion) return;
      setCopiedPhone(phone);
      void message.success({ content: '手机号已复制', duration: 1.5 });
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedPhone(null), 1500);
    } catch {
      if (version.current !== requestVersion) return;
      void message.error({
        content: '复制失败，请选中手机号手动复制',
        duration: 2,
      });
    } finally {
      if (version.current === requestVersion) copying.current = false;
    }
  };

  return (
    <div className={cx('customer-contact-cell', styles.cell)}>
      <div className={styles.name}>{name}</div>
      {phone?.trim() ? (
        <div className={styles.phoneRow}>
          <span className={styles.phone}>{formatPhone(phone)}</span>
          <button
            type="button"
            className={cx('copy-phone-button', styles.copy)}
            aria-label="复制手机号"
            data-copied={copiedPhone === phone}
            onClick={copyPhone}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {copiedPhone === phone ? <CheckOutlined /> : <CopyOutlined />}
          </button>
        </div>
      ) : (
        <div className={styles.phoneRow}>
          <span className={styles.phone}>--</span>
        </div>
      )}
    </div>
  );
}
