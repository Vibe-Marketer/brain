import { useEffect, useCallback, useRef, useState } from "react";

interface UseListKeyboardNavigationOptions<T> {
  /**
   * The list of items to navigate
   */
  items: T[];
  /**
   * Function to get a unique ID from an item
   */
  getItemId: (item: T) => string;
  /**
   * Currently selected item ID (for syncing with external selection)
   */
  selectedId: string | null;
  /**
   * Callback when an item is selected (Enter or Space)
   */
  onSelect: (item: T) => void;
  /**
   * Whether keyboard navigation is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Container ref to scope keyboard events (optional)
   * If not provided, uses document-level events
   */
  containerRef?: React.RefObject<HTMLElement>;
}

interface UseListKeyboardNavigationResult {
  /**
   * Currently focused item ID (for styling)
   */
  focusedId: string | null;
  /**
   * Ref to attach to each row for scrolling into view
   */
  getRowRef: (id: string) => (el: HTMLElement | null) => void;
  /**
   * Handler to call when row is clicked (syncs focus with selection)
   */
  handleRowClick: (item: { id: string }) => void;
}

/**
 * Hook for handling keyboard navigation in lists (Up/Down arrows, Enter, Space).
 *
 * @example
 * const { focusedId, getRowRef, handleRowClick } = useListKeyboardNavigation({
 *   items: folders,
 *   getItemId: (f) => f.id,
 *   selectedId: selectedFolderId,
 *   onSelect: handleFolderClick,
 * });
 */
export function useListKeyboardNavigation<T extends { id: string }>({
  items,
  getItemId,
  selectedId,
  onSelect,
  enabled = true,
  containerRef,
}: UseListKeyboardNavigationOptions<T>): UseListKeyboardNavigationResult {
  // Track focused index internally
  const focusedIndexRef = useRef<number>(-1);
  const focusedIdRef = useRef<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Sync focused index when selection changes externally
  useEffect(() => {
    if (selectedId) {
      const index = items.findIndex((item) => getItemId(item) === selectedId);
      if (index !== -1) {
        focusedIndexRef.current = index;
        focusedIdRef.current = selectedId;
      }
    }
  }, [selectedId, items, getItemId]);

  // Scroll focused item into view
  const scrollIntoView = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  // Move focus up or down
  const moveFocus = useCallback(
    (direction: "up" | "down") => {
      if (items.length === 0) return;

      let newIndex = focusedIndexRef.current;

      if (direction === "up") {
        newIndex = newIndex <= 0 ? items.length - 1 : newIndex - 1;
      } else {
        newIndex = newIndex >= items.length - 1 ? 0 : newIndex + 1;
      }

      focusedIndexRef.current = newIndex;
      const item = items[newIndex];
      const id = getItemId(item);
      focusedIdRef.current = id;

      // Trigger re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent("list-focus-change", { detail: { id } }));
      scrollIntoView(id);
    },
    [items, getItemId, scrollIntoView]
  );

  // Select the currently focused item
  const selectFocused = useCallback(() => {
    if (focusedIndexRef.current >= 0 && focusedIndexRef.current < items.length) {
      const item = items[focusedIndexRef.current];
      onSelect(item);
    }
  }, [items, onSelect]);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't handle if modifier keys are pressed (let other shortcuts handle)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveFocus("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          moveFocus("down");
          break;
        case "Enter":
          event.preventDefault();
          selectFocused();
          break;
        case " ": // Space
          event.preventDefault();
          selectFocused();
          break;
      }
    };

    const element = containerRef?.current || document;
    element.addEventListener("keydown", handleKeyDown as EventListener);
    return () => element.removeEventListener("keydown", handleKeyDown as EventListener);
  }, [enabled, moveFocus, selectFocused, containerRef]);

  // Get ref callback for each row
  const getRowRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        rowRefs.current.set(id, el);
      } else {
        rowRefs.current.delete(id);
      }
    },
    []
  );

  // Handle row click to sync focus
  const handleRowClick = useCallback(
    (item: { id: string }) => {
      const index = items.findIndex((i) => getItemId(i as T) === item.id);
      if (index !== -1) {
        focusedIndexRef.current = index;
        focusedIdRef.current = item.id;
      }
    },
    [items, getItemId]
  );

  // Return the current focused ID - we need to use a state for reactivity
  // Using a custom hook pattern with useState for re-renders
  return {
    focusedId: focusedIdRef.current,
    getRowRef,
    handleRowClick,
  };
}

/**
 * React hook that uses state for the focused ID to trigger re-renders.
 * This is the recommended version for UI components.
 */
export function useListKeyboardNavigationWithState<T extends { id: string }>({
  items,
  getItemId,
  selectedId,
  onSelect,
  enabled = true,
  containerRef,
}: UseListKeyboardNavigationOptions<T>): UseListKeyboardNavigationResult & { focusedId: string | null } {
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Sync focused ID when selection changes externally
  useEffect(() => {
    if (selectedId) {
      setFocusedId(selectedId);
    }
  }, [selectedId]);

  // Scroll focused item into view
  const scrollIntoView = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  // Get current focused index
  const getFocusedIndex = useCallback(() => {
    if (!focusedId) return -1;
    return items.findIndex((item) => getItemId(item) === focusedId);
  }, [focusedId, items, getItemId]);

  // Move focus up or down
  const moveFocus = useCallback(
    (direction: "up" | "down") => {
      if (items.length === 0) return;

      let currentIndex = getFocusedIndex();
      let newIndex: number;

      if (direction === "up") {
        newIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
      }

      const item = items[newIndex];
      const id = getItemId(item);
      setFocusedId(id);
      scrollIntoView(id);
    },
    [items, getItemId, scrollIntoView, getFocusedIndex]
  );

  // Select the currently focused item
  const selectFocused = useCallback(() => {
    const index = getFocusedIndex();
    if (index >= 0 && index < items.length) {
      const item = items[index];
      onSelect(item);
    }
  }, [items, onSelect, getFocusedIndex]);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't handle if modifier keys are pressed (let other shortcuts handle)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveFocus("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          moveFocus("down");
          break;
        case "Enter":
          event.preventDefault();
          selectFocused();
          break;
        case " ": // Space
          event.preventDefault();
          selectFocused();
          break;
      }
    };

    const element = containerRef?.current || document;
    element.addEventListener("keydown", handleKeyDown as EventListener);
    return () => element.removeEventListener("keydown", handleKeyDown as EventListener);
  }, [enabled, moveFocus, selectFocused, containerRef]);

  // Get ref callback for each row
  const getRowRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        rowRefs.current.set(id, el);
      } else {
        rowRefs.current.delete(id);
      }
    },
    []
  );

  // Handle row click to sync focus
  const handleRowClick = useCallback(
    (item: { id: string }) => {
      setFocusedId(item.id);
    },
    []
  );

  return {
    focusedId,
    getRowRef,
    handleRowClick,
  };
}
