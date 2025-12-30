import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut, useSearchShortcut } from '../useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // Helper to dispatch keyboard events
  const dispatchKeyEvent = (
    key: string,
    options: Partial<{
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
    }> = {}
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
      altKey: options.altKey ?? false,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    return { event, preventDefaultSpy };
  };

  describe('event listener lifecycle', () => {
    it('should add keydown event listener on mount', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should remove keydown event listener on unmount', () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() =>
        useKeyboardShortcut(callback, { key: 'k' })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should not add listener when disabled', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'k', enabled: false })
      );

      // Should not have added a keydown listener when disabled
      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'keydown'
      );
      expect(keydownCalls).toHaveLength(0);
    });
  });

  describe('Cmd/Ctrl+K shortcut (default cmdOrCtrl: true)', () => {
    it('should trigger callback with metaKey (Mac Cmd)', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('k', { metaKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should trigger callback with ctrlKey (Windows/Linux)', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('k', { ctrlKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger callback without modifier key', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('k');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger callback for wrong key', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('p', { metaKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should be case insensitive for letter keys', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'K' }));

      dispatchKeyEvent('k', { metaKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('prevent default behavior', () => {
    it('should prevent default by default', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      const { preventDefaultSpy } = dispatchKeyEvent('k', { metaKey: true });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not prevent default when preventDefault: false', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'k', preventDefault: false })
      );

      const { preventDefaultSpy } = dispatchKeyEvent('k', { metaKey: true });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('shortcut without cmdOrCtrl modifier', () => {
    it('should trigger callback without modifier when cmdOrCtrl: false', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'Escape', cmdOrCtrl: false })
      );

      dispatchKeyEvent('Escape');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when modifier is pressed and cmdOrCtrl: false', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'Escape', cmdOrCtrl: false })
      );

      dispatchKeyEvent('Escape', { metaKey: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('shift modifier', () => {
    it('should require shift when shift: true', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'p', shift: true })
      );

      // Without shift
      dispatchKeyEvent('p', { metaKey: true });
      expect(callback).not.toHaveBeenCalled();

      // With shift
      dispatchKeyEvent('p', { metaKey: true, shiftKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when shift is pressed but not required', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('k', { metaKey: true, shiftKey: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('alt modifier', () => {
    it('should require alt when alt: true', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 's', alt: true })
      );

      // Without alt
      dispatchKeyEvent('s', { metaKey: true });
      expect(callback).not.toHaveBeenCalled();

      // With alt
      dispatchKeyEvent('s', { metaKey: true, altKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when alt is pressed but not required', () => {
      const callback = vi.fn();
      renderHook(() => useKeyboardShortcut(callback, { key: 'k' }));

      dispatchKeyEvent('k', { metaKey: true, altKey: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('enabled option', () => {
    it('should not trigger when enabled: false', () => {
      const callback = vi.fn();
      renderHook(() =>
        useKeyboardShortcut(callback, { key: 'k', enabled: false })
      );

      dispatchKeyEvent('k', { metaKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger when enabled changes from false to true', () => {
      const callback = vi.fn();
      const { rerender } = renderHook(
        ({ enabled }) => useKeyboardShortcut(callback, { key: 'k', enabled }),
        { initialProps: { enabled: false } }
      );

      dispatchKeyEvent('k', { metaKey: true });
      expect(callback).not.toHaveBeenCalled();

      rerender({ enabled: true });

      dispatchKeyEvent('k', { metaKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('callback stability', () => {
    it('should handle callback changes correctly', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const { rerender } = renderHook(
        ({ cb }) => useKeyboardShortcut(cb, { key: 'k' }),
        { initialProps: { cb: callback1 } }
      );

      dispatchKeyEvent('k', { metaKey: true });
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      rerender({ cb: callback2 });

      dispatchKeyEvent('k', { metaKey: true });
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useSearchShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dispatchKeyEvent = (
    key: string,
    options: Partial<{
      metaKey: boolean;
      ctrlKey: boolean;
    }> = {}
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  };

  it('should trigger callback on Cmd+K', () => {
    const callback = vi.fn();
    renderHook(() => useSearchShortcut(callback));

    dispatchKeyEvent('k', { metaKey: true });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger callback on Ctrl+K', () => {
    const callback = vi.fn();
    renderHook(() => useSearchShortcut(callback));

    dispatchKeyEvent('k', { ctrlKey: true });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when disabled', () => {
    const callback = vi.fn();
    renderHook(() => useSearchShortcut(callback, false));

    dispatchKeyEvent('k', { metaKey: true });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should use default enabled: true', () => {
    const callback = vi.fn();
    renderHook(() => useSearchShortcut(callback));

    dispatchKeyEvent('k', { metaKey: true });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
