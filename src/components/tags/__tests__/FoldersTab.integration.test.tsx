/**
 * FoldersTab Integration Tests
 *
 * Tests folder CRUD operations in the 3-pane context:
 * - Folder list rendering and selection
 * - Right panel integration (FolderDetailPanel opens on selection)
 * - Inline rename functionality
 * - Context menu operations (Rename, Duplicate, Delete)
 * - Keyboard shortcuts (Cmd+N, Cmd+E, Cmd+Backspace)
 * - State updates after CRUD operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock AuthContext — FoldersTab indirectly uses useAuth via imported hooks
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { user: { id: 'test-user-id' } },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useFolders hook
const mockCreateFolder = vi.fn();
const mockUpdateFolder = vi.fn();
const mockDeleteFolder = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/hooks/useFolders', () => ({
  useFolders: vi.fn(() => ({
    data: [],
    isLoading: false,
    refetch: mockRefetch,
  })),
  useFolderAssignments: vi.fn(() => ({
    data: {},
    isLoading: false,
  })),
  useDeleteFolder: vi.fn(() => ({
    mutateAsync: mockDeleteFolder,
    isPending: false,
  })),
  useRenameFolder: vi.fn(() => ({
    mutateAsync: mockUpdateFolder,
    isPending: false,
  })),
  useCreateFolder: vi.fn(() => ({
    mutateAsync: mockCreateFolder,
    isPending: false,
  })),
}));

// Mock panelStore
const mockOpenPanel = vi.fn();
const mockClosePanel = vi.fn();
const mockTogglePin = vi.fn();

vi.mock('@/stores/panelStore', () => ({
  usePanelStore: vi.fn(() => ({
    openPanel: mockOpenPanel,
    closePanel: mockClosePanel,
    togglePin: mockTogglePin,
    panelData: null,
    panelType: null,
    isPanelOpen: false,
    isPinned: false,
  })),
}));

// Mock keyboard shortcut hook
vi.mock('@/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn(),
}));

// Mock list keyboard navigation hook
vi.mock('@/hooks/useListKeyboardNavigation', () => ({
  useListKeyboardNavigationWithState: vi.fn(() => ({
    focusedId: null,
    getRowRef: () => vi.fn(),
    handleRowClick: vi.fn(),
  })),
}));

// Mock virtual list hook
vi.mock('@/hooks/useVirtualList', () => ({
  useVirtualTable: vi.fn(({ items }) => ({
    visibleItems: items.map((item: any, index: number) => ({ item, index })),
    isVirtualized: false,
    containerRef: { current: null },
    handleScroll: vi.fn(),
    offsetBefore: 0,
    offsetAfter: 0,
    containerStyle: {},
    scrollToIndex: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useOrganizationContext (used by QuickCreateFolderDialog for organization-scoped folder operations)
vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: vi.fn(() => ({
    activeOrganizationId: 'test-organization-id',
    activeOrgId: 'test-organization-id',
    activeWorkspaceId: 'test-workspace-id',
    isLoading: false,
    isInitialized: true,
    error: null,
    organizations: [],
    workspaces: [],
    activeOrganization: null,
    activeWorkspace: null,
    isPersonalOrganization: true,
    setActiveOrganization: vi.fn(),
    setActiveWorkspace: vi.fn(),
    switchOrganization: vi.fn(),
    switchWorkspace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Import after mocking
import { FoldersTab } from '../FoldersTab';
import { useFolders, useFolderAssignments } from '@/hooks/useFolders';
import { usePanelStore } from '@/stores/panelStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useListKeyboardNavigationWithState } from '@/hooks/useListKeyboardNavigation';
import type { Folder } from '@/types/workspace';

// Test data
const createMockFolder = (overrides: Partial<Folder> = {}): Folder => ({
  id: 'folder-1',
  user_id: 'user-1',
  organization_id: 'test-organization-id',
  name: 'Test Folder',
  description: null,
  color: '#6B7280',
  icon: '📁',
  parent_id: null,
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Helper to create QueryClient wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('FoldersTab Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset useFolders mock to default state
    vi.mocked(useFolders).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: mockRefetch,
      });

    // Reset panelStore mock
    vi.mocked(usePanelStore).mockReturnValue({
      openPanel: mockOpenPanel,
      closePanel: mockClosePanel,
      togglePin: mockTogglePin,
      panelData: null,
      panelType: null,
      isPanelOpen: false,
      isPinned: false,
      panelHistory: [],
      goBack: vi.fn(),
      clearHistory: vi.fn(),
    });

    // Reset keyboard shortcut mock
    vi.mocked(useKeyboardShortcut).mockImplementation(() => {});

    // Reset list keyboard navigation mock
    vi.mocked(useListKeyboardNavigationWithState).mockReturnValue({
      focusedId: null,
      getRowRef: () => vi.fn(),
      handleRowClick: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Folder List Rendering', () => {
    it('should render empty state when no folders exist', () => {
      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(screen.getByText('No folders yet')).toBeInTheDocument();
      expect(screen.getByText(/Create folders to organize your calls/)).toBeInTheDocument();
      // There are two Create Folder buttons: one in header, one in empty state
      const createButtons = screen.getAllByRole('button', { name: /Create Folder/i });
      expect(createButtons.length).toBe(2);
    });

    it('should render folder list with correct data', () => {
      const mockFolders = [
        createMockFolder({ id: 'folder-1', name: 'Work', icon: '💼' }),
        createMockFolder({ id: 'folder-2', name: 'Personal', icon: '🏠', position: 1 }),
        createMockFolder({ id: 'folder-3', name: 'Archive', icon: '📦', position: 2 }),
      ];

      vi.mocked(useFolders).mockReturnValue({
        data: mockFolders,
        isLoading: false,
        refetch: mockRefetch,
      });
      vi.mocked(useFolderAssignments).mockReturnValue({
        data: { '1': ['folder-1'], '2': ['folder-1', 'folder-2'] },
        isLoading: false,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('should display folder call counts from assignments', () => {
      const mockFolders = [createMockFolder({ id: 'folder-1', name: 'Work' })];

      vi.mocked(useFolders).mockReturnValue({
        data: mockFolders,
        isLoading: false,
        refetch: mockRefetch,
      });
      vi.mocked(useFolderAssignments).mockReturnValue({
        data: {
          '1': ['folder-1'],
          '2': ['folder-1'],
          '3': ['folder-1'],
        },
        isLoading: false,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Folder should show 3 calls (3 recordings assigned)
      expect(screen.getByText('3')).toBeInTheDocument();
    });

  });

  describe('Folder Selection and Right Panel Integration', () => {
    it('should open right panel when clicking a folder', async () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Find and click the folder row
      const folderRow = screen.getByText('Work').closest('tr');
      expect(folderRow).toBeInTheDocument();

      if (folderRow) {
        fireEvent.click(folderRow);
      }

      expect(mockOpenPanel).toHaveBeenCalledWith('folder-detail', { type: 'folder-detail', folderId: 'folder-1' });
    });

  });

  describe('Inline Rename Functionality', () => {
    it('should enter edit mode on double-click of folder name', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const folderName = screen.getByText('Work');
      await user.dblClick(folderName);

      // Should show input with current name
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Work');
    });

    it('should save renamed folder on Enter key', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Enter edit mode
      const folderName = screen.getByText('Work');
      await user.dblClick(folderName);

      // Clear and type new name
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Work Name{Enter}');

      await waitFor(() => {
        expect(mockUpdateFolder).toHaveBeenCalledWith({ folderId: 'folder-1', name: 'New Work Name' });
      });
    });

    it('should cancel rename on Escape key', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Enter edit mode
      const folderName = screen.getByText('Work');
      await user.dblClick(folderName);

      // Type something then cancel
      const input = screen.getByRole('textbox');
      await user.type(input, 'Changed{Escape}');

      // Should not have called update
      expect(mockUpdateFolder).not.toHaveBeenCalled();

      // Should exit edit mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should save on blur', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Enter edit mode
      const folderName = screen.getByText('Work');
      await user.dblClick(folderName);

      // Clear and type new name
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Blurred Name');

      // Blur by clicking elsewhere
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateFolder).toHaveBeenCalledWith({ folderId: 'folder-1', name: 'Blurred Name' });
      });
    });
  });

  describe('Context Menu Operations', () => {
    it('should show context menu with Rename, Duplicate, Delete options', async () => {
      const _user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const folderRow = screen.getByText('Work').closest('tr');
      expect(folderRow).toBeInTheDocument();

      if (folderRow) {
        // Right-click to open context menu
        fireEvent.contextMenu(folderRow);
      }

      await waitFor(() => {
        expect(screen.getByText('Rename')).toBeInTheDocument();
        expect(screen.getByText('Duplicate')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Confirmation Flow', () => {

    it('should show confirmation dialog when clicking delete', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTitle('Delete folder');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Folder')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
        expect(screen.getByText('"Work"', { exact: false })).toBeInTheDocument();
      });
    });

    it('should call deleteFolder when confirming deletion', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Open delete confirmation
      const deleteButton = screen.getByTitle('Delete folder');
      await user.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteFolder).toHaveBeenCalledWith('folder-1');
      });
    });

    it('should close confirmation dialog on cancel', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Open delete confirmation
      const deleteButton = screen.getByTitle('Delete folder');
      await user.click(deleteButton);

      // Click cancel
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockDeleteFolder).not.toHaveBeenCalled();
      });
    });
  });

  describe('Folder Duplication', () => {
    it('should create duplicate folder with "Copy of" prefix', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({
        id: 'folder-1',
        name: 'Work',
        color: '#FF0000',
        icon: '💼',
        description: 'Work stuff',
      });

      vi.mocked(useFolders).mockReturnValue({
        data: [mockFolder],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const folderRow = screen.getByText('Work').closest('tr');
      if (folderRow) {
        fireEvent.contextMenu(folderRow);
      }

      await waitFor(() => {
        expect(screen.getByText('Duplicate')).toBeInTheDocument();
      });

      const duplicateMenuItem = screen.getByText('Duplicate');
      await user.click(duplicateMenuItem);

      await waitFor(() => {
        expect(mockCreateFolder).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Copy of Work',
            workspaceId: 'test-workspace-id',
            organizationId: 'test-organization-id',
          })
        );
      });
    });
  });

});
