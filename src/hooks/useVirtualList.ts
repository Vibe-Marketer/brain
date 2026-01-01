import { useState, useRef, useCallback, useEffect, useMemo } from "react";

interface UseVirtualListOptions<T> {
  /**
   * The full list of items to virtualize
   */
  items: T[];
  /**
   * Height of each row in pixels
   * @default 44
   */
  rowHeight?: number;
  /**
   * Number of rows to render above/below the visible area
   * @default 5
   */
  overscan?: number;
  /**
   * Height of the container in pixels (or 'auto' to use available space)
   * @default 400
   */
  containerHeight?: number;
  /**
   * Threshold for enabling virtualization (don't virtualize small lists)
   * @default 50
   */
  threshold?: number;
  /**
   * Get unique key for item
   */
  getKey: (item: T, index: number) => string;
}

interface VirtualItem<T> {
  item: T;
  index: number;
  key: string;
  style: React.CSSProperties;
}

interface UseVirtualListResult<T> {
  /**
   * Items to render (only visible ones + overscan)
   */
  virtualItems: VirtualItem<T>[];
  /**
   * Total height of the list (for scroll container)
   */
  totalHeight: number;
  /**
   * Props to spread on the scroll container
   */
  containerProps: {
    ref: React.RefObject<HTMLDivElement>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    style: React.CSSProperties;
  };
  /**
   * Props to spread on the inner container (maintains scroll height)
   */
  innerProps: {
    style: React.CSSProperties;
  };
  /**
   * Whether virtualization is active (false for small lists)
   */
  isVirtualized: boolean;
  /**
   * Scroll to a specific index
   */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /**
   * Get the offset for a specific row
   */
  getRowOffset: (index: number) => number;
}

/**
 * Hook for virtualizing large lists to improve performance.
 * Only renders visible items plus overscan, significantly reducing DOM nodes.
 *
 * @example
 * const { virtualItems, containerProps, innerProps, isVirtualized } = useVirtualList({
 *   items: folders,
 *   rowHeight: 44,
 *   containerHeight: 500,
 *   getKey: (folder) => folder.id,
 * });
 *
 * return (
 *   <div {...containerProps}>
 *     <div {...innerProps}>
 *       {virtualItems.map(({ item, key, style }) => (
 *         <div key={key} style={style}>
 *           {item.name}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 */
export function useVirtualList<T>({
  items,
  rowHeight = 44,
  overscan = 5,
  containerHeight = 400,
  threshold = 50,
  getKey,
}: UseVirtualListOptions<T>): UseVirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightActual, setContainerHeightActual] = useState(containerHeight);

  // Update container height on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        if (height > 0) {
          setContainerHeightActual(height);
        }
      }
    };

    // Initial measurement
    updateHeight();

    // Observe resize
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Don't virtualize small lists
  const isVirtualized = items.length > threshold;

  // Calculate total height
  const totalHeight = items.length * rowHeight;

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (!isVirtualized) {
      return { startIndex: 0, endIndex: items.length - 1 };
    }

    const start = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeightActual / rowHeight);
    const end = Math.min(start + visibleCount, items.length - 1);

    // Apply overscan
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(items.length - 1, end + overscan);

    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
    };
  }, [scrollTop, rowHeight, containerHeightActual, items.length, overscan, isVirtualized]);

  // Create virtual items with positioning
  const virtualItems = useMemo(() => {
    if (!isVirtualized) {
      // Return all items without positioning for non-virtualized lists
      return items.map((item, index) => ({
        item,
        index,
        key: getKey(item, index),
        style: {} as React.CSSProperties,
      }));
    }

    const result: VirtualItem<T>[] = [];
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      const item = items[i];
      result.push({
        item,
        index: i,
        key: getKey(item, i),
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: rowHeight,
          transform: `translateY(${i * rowHeight}px)`,
        },
      });
    }
    return result;
  }, [items, startIndex, endIndex, rowHeight, getKey, isVirtualized]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Scroll to a specific index
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      if (!containerRef.current) return;
      const offset = index * rowHeight;
      containerRef.current.scrollTo({ top: offset, behavior });
    },
    [rowHeight]
  );

  // Get offset for a specific row
  const getRowOffset = useCallback(
    (index: number) => index * rowHeight,
    [rowHeight]
  );

  return {
    virtualItems,
    totalHeight,
    containerProps: {
      ref: containerRef,
      onScroll: handleScroll,
      style: {
        overflow: "auto",
        height: containerHeight,
        position: "relative",
      },
    },
    innerProps: {
      style: isVirtualized
        ? {
            height: totalHeight,
            position: "relative",
          }
        : {},
    },
    isVirtualized,
    scrollToIndex,
    getRowOffset,
  };
}

/**
 * Simplified version for table-based lists.
 * Works with tables that use tbody for scrolling.
 */
export function useVirtualTable<T>({
  items,
  rowHeight = 44,
  overscan = 5,
  containerHeight = 400,
  threshold = 50,
  getKey,
}: UseVirtualListOptions<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightActual, setContainerHeightActual] = useState(containerHeight);

  // Update container height on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        if (height > 0) {
          setContainerHeightActual(height);
        }
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Don't virtualize small lists
  const isVirtualized = items.length > threshold;

  // Calculate total height
  const totalHeight = items.length * rowHeight;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (!isVirtualized) {
      return { startIndex: 0, endIndex: items.length - 1, offsetBefore: 0, offsetAfter: 0 };
    }

    const start = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeightActual / rowHeight);
    const end = Math.min(start + visibleCount, items.length - 1);

    // Apply overscan
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(items.length - 1, end + overscan);

    // Calculate offsets for spacer rows
    const offsetBefore = startWithOverscan * rowHeight;
    const offsetAfter = Math.max(0, (items.length - 1 - endWithOverscan) * rowHeight);

    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
      offsetBefore,
      offsetAfter,
    };
  }, [scrollTop, rowHeight, containerHeightActual, items.length, overscan, isVirtualized]);

  // Get visible items
  const visibleItems = useMemo(() => {
    if (!isVirtualized) {
      return items.map((item, index) => ({
        item,
        index,
        key: getKey(item, index),
      }));
    }

    const result: { item: T; index: number; key: string }[] = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex && i < items.length; i++) {
      const item = items[i];
      result.push({
        item,
        index: i,
        key: getKey(item, i),
      });
    }
    return result;
  }, [items, visibleRange.startIndex, visibleRange.endIndex, getKey, isVirtualized]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Scroll to a specific index
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      if (!containerRef.current) return;
      const offset = index * rowHeight;
      containerRef.current.scrollTo({ top: offset, behavior });
    },
    [rowHeight]
  );

  return {
    visibleItems,
    isVirtualized,
    containerRef,
    handleScroll,
    scrollToIndex,
    // Spacer heights for before/after visible rows
    offsetBefore: visibleRange.offsetBefore,
    offsetAfter: visibleRange.offsetAfter,
    totalHeight,
    containerStyle: {
      overflow: "auto",
      maxHeight: containerHeight,
      position: "relative" as const,
    },
  };
}
