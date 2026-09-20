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

  describe('openPanel', () => {

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

    it('should not add to history when no previous panel', () => {
      const { openPanel } = usePanelStore.getState();

      act(() => {
        openPanel('call-detail', { id: '1' });
      });

      expect(usePanelStore.getState().panelHistory).toEqual([]);
    });

  });

  describe('closePanel', () => {

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

  });

  describe('action combinations', () => {

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
