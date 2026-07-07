import React from 'react';

export default function BrandLogo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '20px',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>⛰</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: '18px',
          color: '#1D2129',
        }}
      >
        「移山」
      </span>
    </div>
  );
}