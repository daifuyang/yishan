
import { useEffect, useState } from 'react';

export function useAttachmentGridColumns(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [gridContainerWidth, setGridContainerWidth] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const width = el.clientWidth || el.getBoundingClientRect().width || 0;
      setGridContainerWidth(width);
    };
    const RO = (window as any).ResizeObserver as typeof ResizeObserver | undefined;
    if (RO && containerRef.current) {
      const ro = new RO(update);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [enabled, containerRef]);

  const gridColumns = (() => {
    const w = gridContainerWidth || 0;
    if (w < 576) return 2;
    if (w < 768) return 3;
    if (w < 992) return 4;
    if (w < 1200) return 5;
    if (w < 1600) return 6;
    return 7;
  })();

  return { gridContainerWidth, gridColumns };
}
