import { useEffect, useCallback } from "react";

interface KeyboardShortcutOptions {
  /**
   * The key to listen for (e.g., 'k', 'p', 'Escape')
   */
  key: string;
  /**
   * Require Cmd (Mac) or Ctrl (Windows/Linux) to be pressed
   * @default true
   */
  cmdOrCtrl?: boolean;
  /**
   * Require Shift to be pressed
   * @default false
   */
  shift?: boolean;
  /**
   * Require Alt/Option to be pressed
   * @default false
   */
  alt?: boolean;
  /**
   * Whether the shortcut is currently enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether to prevent the default browser behavior
   * @default true
   */
  preventDefault?: boolean;
}

/**
 * Hook for detecting keyboard shortcuts with modifier keys.
 *
 * @param callback - Function to call when the shortcut is triggered
 * @param options - Configuration options for the keyboard shortcut
 *
 * @example
 * // Detect Cmd/Ctrl+K to open search
 * useKeyboardShortcut(() => setOpen(true), { key: 'k' });
 *
 * @example
 * // Detect Cmd/Ctrl+Shift+P for command palette
 * useKeyboardShortcut(openPalette, { key: 'p', shift: true });
 *
 * @example
 * // Detect Escape key (no modifiers)
 * useKeyboardShortcut(handleClose, { key: 'Escape', cmdOrCtrl: false });
 */
export function useKeyboardShortcut(
  callback: () => void,
  options: KeyboardShortcutOptions
): void {
  const {
    key,
    cmdOrCtrl = true,
    shift = false,
    alt = false,
    enabled = true,
    preventDefault = true,
  } = options;

  // Memoize the callback to avoid stale closures
  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check modifier keys
      const cmdOrCtrlPressed = event.metaKey || event.ctrlKey;
      const shiftPressed = event.shiftKey;
      const altPressed = event.altKey;

      // Validate modifier requirements
      if (cmdOrCtrl && !cmdOrCtrlPressed) return;
      if (!cmdOrCtrl && cmdOrCtrlPressed) return;
      if (shift && !shiftPressed) return;
      if (!shift && shiftPressed && cmdOrCtrl) return; // Don't fire if shift is pressed but not required (for modifier shortcuts)
      if (alt && !altPressed) return;
      if (!alt && altPressed) return;

      // Check the key (case-insensitive for letters)
      const pressedKey = event.key.toLowerCase();
      const targetKey = key.toLowerCase();

      if (pressedKey !== targetKey) return;

      // Prevent default browser behavior (e.g., Cmd+K opens browser search)
      if (preventDefault) {
        event.preventDefault();
      }

      stableCallback();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [key, cmdOrCtrl, shift, alt, enabled, preventDefault, stableCallback]);
}

/**
 * Convenience hook for Cmd/Ctrl+K shortcut (commonly used for search)
 */
export function useSearchShortcut(
  callback: () => void,
  enabled: boolean = true
): void {
  useKeyboardShortcut(callback, { key: "k", enabled });
}
