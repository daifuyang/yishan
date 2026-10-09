import { renderHook } from '@testing-library/react';
import { useResponsiveDrawerWidth } from './useResponsiveDrawerWidth';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

describe('useResponsiveDrawerWidth', () => {
  it('uses a fluid desktop width so the customer workspace grows with the viewport', () => {
    setViewportWidth(1440);

    const { result } = renderHook(() => useResponsiveDrawerWidth());

    expect(result.current).toBe('clamp(860px, 68vw, 1320px)');
  });

  it('uses the full viewport on phone-sized screens', () => {
    setViewportWidth(767);

    const { result } = renderHook(() => useResponsiveDrawerWidth());

    expect(result.current).toBe('100vw');
  });
});
