import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { usePanelStore } from '../panelStore';
import type { PanelType } from '../panelStore';

describe('panelStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    act(() => {
      usePanelStore.setState({
        isPanelOpen: false,
        panelType: null,
        panelData: null,
        isPinned: false,
        panelHistory: [],
      });
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = usePanelStore.getState();

      expect(state.isPanelOpen).toBe(false);
      expect(state.panelType).toBeNull();
      expect(state.panelData).toBeNull();
      expect(state.isPinned).toBe(false);
      expect(state.panelHistory).toEqual([]);
    });
  });

  describe('openPanel', () => {
    it('should set isPanelOpen to true', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('call-detail');
      });

      expect(usePanelStore.getState().isPanelOpen).toBe(true);
    });

    it('should set panelType correctly', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('insight-detail');
      });

      expect(usePanelStore.getState().panelType).toBe('insight-detail');
    });

    it('should set panelData correctly', () => {
      const { openPanel } = usePanelStore.getState();
      const mockData = { id: '123', title: 'Test Call' };

      act(() => {
        openPanel('call-detail', mockData);
      });

      expect(usePanelStore.getState().panelData).toEqual(mockData);
    });

    it('should set panelData to null when no data provided', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('filter-tool');
      });

      expect(usePanelStore.getState().panelData).toBeNull();
    });

    it('should add current panel to history when opening a new panel', () => {
      const { openPanel } = usePanelStore.getState();
      const firstData = { id: '1' };
      const secondData = { id: '2' };

      act(() => {
        openPanel('call-detail', firstData);
      });

      act(() => {
        openPanel('insight-detail', secondData);
      });

      const history = usePanelStore.getState().panelHistory;
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ type: 'call-detail', data: firstData });
    });

    it('should build up history with multiple panel opens', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('call-detail', { id: '1' });
      });

      act(() => {
        openPanel('insight-detail', { id: '2' });
      });

      act(() => {
        openPanel('folder-detail', { id: '3' });
      });

      const history = usePanelStore.getState().panelHistory;
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ type: 'call-detail', data: { id: '1' } });
      expect(history[1]).toEqual({ type: 'insight-detail', data: { id: '2' } });
    });

    it('should not add to history when no previous panel', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('call-detail', { id: '1' });
      });

      expect(usePanelStore.getState().panelHistory).toEqual([]);
    });

    it('should handle all panel types', () => {
      const panelTypes: PanelType[] = [
        'workspace-detail',
        'call-detail',
        'insight-detail',
        'filter-tool',
        'ai-assistant',
        'inspector',
        'folder-detail',
        'tag-detail',
        'setting-help',
        // Multi-pane navigation panel types
        'settings-category',
        'settings-detail',
        'sorting-category',
        'sorting-detail',
      ];

      panelTypes.forEach((type) => {
        act(() => {
          usePanelStore.setState({
            isPanelOpen: false,
            panelType: null,
            panelData: null,
            panelHistory: [],
          });
        });

        const { openPanel } = usePanelStore.getState();

        act(() => {
          openPanel(type);
        });

        expect(usePanelStore.getState().panelType).toBe(type);
      });
    });
  });

  describe('closePanel', () => {
    it('should set isPanelOpen to false', () => {
      act(() => {
        usePanelStore.setState({ isPanelOpen: true, panelType: 'call-detail' });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      expect(usePanelStore.getState().isPanelOpen).toBe(false);
    });

    it('should reset panelType to null', () => {
      act(() => {
        usePanelStore.setState({ isPanelOpen: true, panelType: 'call-detail' });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      expect(usePanelStore.getState().panelType).toBeNull();
    });

    it('should reset panelData to null', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          panelData: { id: '123' },
        });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      expect(usePanelStore.getState().panelData).toBeNull();
    });

    it('should clear panelHistory when closing', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'insight-detail',
          panelHistory: [
            { type: 'call-detail', data: { id: '1' } },
            { type: 'folder-detail', data: { id: '2' } },
          ],
        });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      expect(usePanelStore.getState().panelHistory).toEqual([]);
    });

    it('should NOT close panel when isPinned is true', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          panelData: { id: '123' },
          isPinned: true,
        });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      const state = usePanelStore.getState();
      expect(state.isPanelOpen).toBe(true);
      expect(state.panelType).toBe('call-detail');
      expect(state.panelData).toEqual({ id: '123' });
    });

    it('should not affect isPinned state', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          isPinned: false,
        });
      });

      const { closePanel } = usePanelStore.getState();

      act(() => {
        closePanel();
      });

      expect(usePanelStore.getState().isPinned).toBe(false);
    });
  });

  describe('togglePin', () => {
    it('should toggle isPinned from false to true', () => {
      const { togglePin } = usePanelStore.getState();

      act(() => {
        togglePin();
      });

      expect(usePanelStore.getState().isPinned).toBe(true);
    });

    it('should toggle isPinned from true to false', () => {
      act(() => {
        usePanelStore.setState({ isPinned: true });
      });

      const { togglePin } = usePanelStore.getState();

      act(() => {
        togglePin();
      });

      expect(usePanelStore.getState().isPinned).toBe(false);
    });

    it('should not affect other state when toggling', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          panelData: { id: '123' },
          isPinned: false,
          panelHistory: [{ type: 'folder-detail', data: null }],
        });
      });

      const { togglePin } = usePanelStore.getState();

      act(() => {
        togglePin();
      });

      const state = usePanelStore.getState();
      expect(state.isPinned).toBe(true);
      expect(state.isPanelOpen).toBe(true);
      expect(state.panelType).toBe('call-detail');
      expect(state.panelData).toEqual({ id: '123' });
      expect(state.panelHistory).toHaveLength(1);
    });
  });

  describe('goBack', () => {
    it('should close panel when history is empty', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          panelData: { id: '123' },
          panelHistory: [],
        });
      });

      const { goBack } = usePanelStore.getState();

      act(() => {
        goBack();
      });

      const state = usePanelStore.getState();
      expect(state.isPanelOpen).toBe(false);
      expect(state.panelType).toBeNull();
      expect(state.panelData).toBeNull();
    });

    it('should restore previous panel from history', () => {
      const previousPanel = { type: 'call-detail' as PanelType, data: { id: '1' } };

      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'insight-detail',
          panelData: { id: '2' },
          panelHistory: [previousPanel],
        });
      });

      const { goBack } = usePanelStore.getState();

      act(() => {
        goBack();
      });

      const state = usePanelStore.getState();
      expect(state.panelType).toBe('call-detail');
      expect(state.panelData).toEqual({ id: '1' });
    });

    it('should remove restored panel from history', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'folder-detail',
          panelData: { id: '3' },
          panelHistory: [
            { type: 'call-detail', data: { id: '1' } },
            { type: 'insight-detail', data: { id: '2' } },
          ],
        });
      });

      const { goBack } = usePanelStore.getState();

      act(() => {
        goBack();
      });

      const history = usePanelStore.getState().panelHistory;
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ type: 'call-detail', data: { id: '1' } });
    });

    it('should support multiple back navigations', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'folder-detail',
          panelData: { id: '3' },
          panelHistory: [
            { type: 'call-detail', data: { id: '1' } },
            { type: 'insight-detail', data: { id: '2' } },
          ],
        });
      });

      const { goBack } = usePanelStore.getState();

      // First back
      act(() => {
        goBack();
      });

      expect(usePanelStore.getState().panelType).toBe('insight-detail');
      expect(usePanelStore.getState().panelHistory).toHaveLength(1);

      // Second back
      act(() => {
        goBack();
      });

      expect(usePanelStore.getState().panelType).toBe('call-detail');
      expect(usePanelStore.getState().panelHistory).toHaveLength(0);

      // Third back (closes panel)
      act(() => {
        goBack();
      });

      expect(usePanelStore.getState().isPanelOpen).toBe(false);
      expect(usePanelStore.getState().panelType).toBeNull();
    });

    it('should keep isPanelOpen true when history has items', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'insight-detail',
          panelData: { id: '2' },
          panelHistory: [{ type: 'call-detail', data: { id: '1' } }],
        });
      });

      const { goBack } = usePanelStore.getState();

      act(() => {
        goBack();
      });

      expect(usePanelStore.getState().isPanelOpen).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('should clear panelHistory', () => {
      act(() => {
        usePanelStore.setState({
          panelHistory: [
            { type: 'call-detail', data: { id: '1' } },
            { type: 'insight-detail', data: { id: '2' } },
          ],
        });
      });

      const { clearHistory } = usePanelStore.getState();

      act(() => {
        clearHistory();
      });

      expect(usePanelStore.getState().panelHistory).toEqual([]);
    });

    it('should not affect other state when clearing history', () => {
      act(() => {
        usePanelStore.setState({
          isPanelOpen: true,
          panelType: 'call-detail',
          panelData: { id: '123' },
          isPinned: true,
          panelHistory: [{ type: 'folder-detail', data: null }],
        });
      });

      const { clearHistory } = usePanelStore.getState();

      act(() => {
        clearHistory();
      });

      const state = usePanelStore.getState();
      expect(state.isPanelOpen).toBe(true);
      expect(state.panelType).toBe('call-detail');
      expect(state.panelData).toEqual({ id: '123' });
      expect(state.isPinned).toBe(true);
      expect(state.panelHistory).toEqual([]);
    });

    it('should handle already empty history', () => {
      const { clearHistory } = usePanelStore.getState();

      act(() => {
        clearHistory();
      });

      expect(usePanelStore.getState().panelHistory).toEqual([]);
    });
  });

  describe('action combinations', () => {
    it('should handle typical panel navigation flow', () => {
      const { openPanel, goBack, closePanel } = usePanelStore.getState();

      // Open first panel
      act(() => {
        openPanel('call-detail', { id: '1', title: 'Call 1' });
      });
      expect(usePanelStore.getState().isPanelOpen).toBe(true);
      expect(usePanelStore.getState().panelType).toBe('call-detail');

      // Navigate to second panel
      act(() => {
        openPanel('insight-detail', { id: '2', type: 'pain' });
      });
      expect(usePanelStore.getState().panelType).toBe('insight-detail');
      expect(usePanelStore.getState().panelHistory).toHaveLength(1);

      // Go back to first panel
      act(() => {
        goBack();
      });
      expect(usePanelStore.getState().panelType).toBe('call-detail');
      expect(usePanelStore.getState().panelData).toEqual({ id: '1', title: 'Call 1' });

      // Close panel
      act(() => {
        closePanel();
      });
      expect(usePanelStore.getState().isPanelOpen).toBe(false);
    });

    it('should handle pinned panel flow', () => {
      const { openPanel, togglePin, closePanel, goBack } = usePanelStore.getState();

      // Open and pin panel
      act(() => {
        openPanel('ai-assistant', { conversation: [] });
      });

      act(() => {
        togglePin();
      });

      expect(usePanelStore.getState().isPinned).toBe(true);

      // Try to close - should fail
      act(() => {
        closePanel();
      });
      expect(usePanelStore.getState().isPanelOpen).toBe(true);

      // Unpin
      act(() => {
        togglePin();
      });

      // Now close should work
      act(() => {
        closePanel();
      });
      expect(usePanelStore.getState().isPanelOpen).toBe(false);
    });

    it('should handle deep navigation with history', () => {
      const { openPanel } = usePanelStore.getState();

      // Build up deep navigation
      act(() => {
        openPanel('workspace-detail', { workspaceId: 'ws-1' });
      });

      act(() => {
        openPanel('folder-detail', { folderId: 'folder-1' });
      });

      act(() => {
        openPanel('call-detail', { callId: 'call-1' });
      });

      act(() => {
        openPanel('insight-detail', { insightId: 'insight-1' });
      });

      const state = usePanelStore.getState();
      expect(state.panelType).toBe('insight-detail');
      expect(state.panelHistory).toHaveLength(3);
      expect(state.panelHistory[0].type).toBe('workspace-detail');
      expect(state.panelHistory[1].type).toBe('folder-detail');
      expect(state.panelHistory[2].type).toBe('call-detail');
    });

    it('should handle clear history mid-navigation', () => {
      const { openPanel, clearHistory, goBack } = usePanelStore.getState();

      // Navigate through panels
      act(() => {
        openPanel('call-detail', { id: '1' });
      });

      act(() => {
        openPanel('insight-detail', { id: '2' });
      });

      // Clear history
      act(() => {
        clearHistory();
      });

      // Try to go back - should close panel since history is empty
      act(() => {
        goBack();
      });

      expect(usePanelStore.getState().isPanelOpen).toBe(false);
    });
  });
});
