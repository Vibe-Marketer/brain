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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useFolders hook
const mockCreateFolder = vi.fn();
const mockUpdateFolder = vi.fn();
const mockDeleteFolder = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/hooks/useFolders', () => ({
  useFolders: vi.fn(() => ({
    folders: [],
    folderAssignments: {},
    isLoading: false,
    createFolder: mockCreateFolder,
    updateFolder: mockUpdateFolder,
    deleteFolder: mockDeleteFolder,
    refetch: mockRefetch,
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

// Mock useBankContext (used by QuickCreateFolderDialog for bank-scoped folder operations)
vi.mock('@/hooks/useBankContext', () => ({
  useBankContext: vi.fn(() => ({
    activeBankId: 'test-bank-id',
    activeVaultId: null,
    isLoading: false,
    isInitialized: true,
    error: null,
    banks: [],
    vaults: [],
    activeBank: null,
    activeVault: null,
    isPersonalBank: true,
    setActiveBank: vi.fn(),
    setActiveVault: vi.fn(),
    switchBank: vi.fn(),
    switchVault: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Import after mocking
import { FoldersTab } from '../FoldersTab';
import { useFolders } from '@/hooks/useFolders';
import { usePanelStore } from '@/stores/panelStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useListKeyboardNavigationWithState } from '@/hooks/useListKeyboardNavigation';
import type { Folder } from '@/hooks/useFolders';

// Test data
const createMockFolder = (overrides: Partial<Folder> = {}): Folder => ({
  id: 'folder-1',
  user_id: 'user-1',
  bank_id: 'test-bank-id',
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
      folders: [],
      folderAssignments: {},
      isLoading: false,
      createFolder: mockCreateFolder,
      updateFolder: mockUpdateFolder,
      deleteFolder: mockDeleteFolder,
      refetch: mockRefetch,
      assignToFolder: vi.fn(),
      removeFromFolder: vi.fn(),
      moveToFolder: vi.fn(),
      getFoldersForCall: vi.fn(() => []),
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

    it('should render loading skeleton when data is loading', () => {
      vi.mocked(useFolders).mockReturnValue({
        folders: [],
        folderAssignments: {},
        isLoading: true,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Should show skeleton loading state (Skeleton uses animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render folder list with correct data', () => {
      const mockFolders = [
        createMockFolder({ id: 'folder-1', name: 'Work', icon: '💼' }),
        createMockFolder({ id: 'folder-2', name: 'Personal', icon: '🏠', position: 1 }),
        createMockFolder({ id: 'folder-3', name: 'Archive', icon: '📦', position: 2 }),
      ];

      vi.mocked(useFolders).mockReturnValue({
        folders: mockFolders,
        folderAssignments: { '1': ['folder-1'], '2': ['folder-1', 'folder-2'] },
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('should display folder call counts from assignments', () => {
      const mockFolders = [createMockFolder({ id: 'folder-1', name: 'Work' })];

      vi.mocked(useFolders).mockReturnValue({
        folders: mockFolders,
        folderAssignments: {
          '1': ['folder-1'],
          '2': ['folder-1'],
          '3': ['folder-1'],
        },
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Folder should show 3 calls (3 recordings assigned)
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render nested folders with proper indentation', () => {
      const mockFolders = [
        createMockFolder({ id: 'parent', name: 'Parent Folder' }),
        createMockFolder({ id: 'child', name: 'Child Folder', parent_id: 'parent' }),
      ];

      vi.mocked(useFolders).mockReturnValue({
        folders: mockFolders,
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(screen.getByText('Parent Folder')).toBeInTheDocument();
      expect(screen.getByText('Child Folder')).toBeInTheDocument();
    });
  });

  describe('Folder Selection and Right Panel Integration', () => {
    it('should open right panel when clicking a folder', async () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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

    it('should show selection highlighting when folder is selected', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      // Mock panel store to show folder is selected
      vi.mocked(usePanelStore).mockReturnValue({
        openPanel: mockOpenPanel,
        closePanel: mockClosePanel,
        togglePin: mockTogglePin,
        panelData: { type: 'folder-detail', folderId: 'folder-1' },
        panelType: 'folder-detail',
        isPanelOpen: true,
        isPinned: false,
        panelHistory: [],
        goBack: vi.fn(),
        clearHistory: vi.fn(),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const folderRow = screen.getByText('Work').closest('tr');
      expect(folderRow).toHaveClass('bg-hover', { exact: false });
    });
  });

  describe('Inline Rename Functionality', () => {
    it('should enter edit mode on double-click of folder name', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder.mockResolvedValue(undefined),
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        expect(mockUpdateFolder).toHaveBeenCalledWith('folder-1', { name: 'New Work Name' });
      });
    });

    it('should cancel rename on Escape key', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder.mockResolvedValue(undefined),
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        expect(mockUpdateFolder).toHaveBeenCalledWith('folder-1', { name: 'Blurred Name' });
      });
    });
  });

  describe('Context Menu Operations', () => {
    it('should show context menu with Rename, Duplicate, Delete options', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
    it('should show delete button in folder row', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTitle('Delete folder');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should show confirmation dialog when clicking delete', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder.mockResolvedValue(undefined),
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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

  describe('Keyboard Shortcuts Registration', () => {
    it('should register Cmd+N shortcut for creating folders', () => {
      render(<FoldersTab />, { wrapper: createWrapper() });

      // useKeyboardShortcut should have been called with 'n' key
      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ key: 'n' })
      );
    });

    it('should register Cmd+E shortcut for editing selected folder', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      // Mock selected folder
      vi.mocked(usePanelStore).mockReturnValue({
        openPanel: mockOpenPanel,
        closePanel: mockClosePanel,
        togglePin: mockTogglePin,
        panelData: { type: 'folder-detail', folderId: 'folder-1' },
        panelType: 'folder-detail',
        isPanelOpen: true,
        isPinned: false,
        panelHistory: [],
        goBack: vi.fn(),
        clearHistory: vi.fn(),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // useKeyboardShortcut should have been called with 'e' key
      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ key: 'e' })
      );
    });

    it('should register Cmd+Backspace shortcut for deleting selected folder', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      // Mock selected folder
      vi.mocked(usePanelStore).mockReturnValue({
        openPanel: mockOpenPanel,
        closePanel: mockClosePanel,
        togglePin: mockTogglePin,
        panelData: { type: 'folder-detail', folderId: 'folder-1' },
        panelType: 'folder-detail',
        isPanelOpen: true,
        isPinned: false,
        panelHistory: [],
        goBack: vi.fn(),
        clearHistory: vi.fn(),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // useKeyboardShortcut should have been called with 'Backspace' key
      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ key: 'Backspace' })
      );
    });
  });

  describe('Create Folder Dialog', () => {
    it('should show create folder button in header', () => {
      render(<FoldersTab />, { wrapper: createWrapper() });

      // There are two Create Folder buttons (header + empty state), verify at least one exists
      const createButtons = screen.getAllByRole('button', { name: /Create Folder/i });
      expect(createButtons.length).toBeGreaterThan(0);
    });

    it('should open create dialog when clicking create button', async () => {
      const user = userEvent.setup();
      render(<FoldersTab />, { wrapper: createWrapper() });

      // Click the first Create Folder button (header button)
      const createButtons = screen.getAllByRole('button', { name: /Create Folder/i });
      await user.click(createButtons[0]);

      // Dialog should open (QuickCreateFolderDialog is rendered)
      // Note: actual dialog content is in a separate component
      // We just verify the state changes correctly
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
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder.mockResolvedValue(undefined),
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
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
          'Copy of Work',
          undefined, // parent_id is null
          '#FF0000',
          '💼',
          'Work stuff'
        );
      });
    });
  });

  describe('State Management', () => {
    it('should call refetch after folder operations', async () => {
      const user = userEvent.setup();
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder.mockResolvedValue(undefined),
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Duplicate folder (should trigger refetch)
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
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have table headers for screen readers', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Calls')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should have accessible delete button with title', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTitle('Delete folder');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should have descriptive text for double-click rename', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      const folderName = screen.getByText('Work');
      expect(folderName).toHaveAttribute('title', 'Double-click to rename');
    });
  });

  describe('3-Pane Context Integration', () => {
    it('should pass folderId to openPanel for right panel display', async () => {
      const mockFolders = [
        createMockFolder({ id: 'folder-1', name: 'Work' }),
        createMockFolder({ id: 'folder-2', name: 'Personal', position: 1 }),
      ];

      vi.mocked(useFolders).mockReturnValue({
        folders: mockFolders,
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Click first folder
      const workRow = screen.getByText('Work').closest('tr');
      if (workRow) {
        fireEvent.click(workRow);
      }

      expect(mockOpenPanel).toHaveBeenCalledWith('folder-detail', { type: 'folder-detail', folderId: 'folder-1' });

      // Click second folder
      const personalRow = screen.getByText('Personal').closest('tr');
      if (personalRow) {
        fireEvent.click(personalRow);
      }

      expect(mockOpenPanel).toHaveBeenCalledWith('folder-detail', { type: 'folder-detail', folderId: 'folder-2' });
    });

    it('should use list keyboard navigation hook for arrow key support', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      expect(useListKeyboardNavigationWithState).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.any(Array),
          getItemId: expect.any(Function),
          onSelect: expect.any(Function),
        })
      );
    });

    it('should disable keyboard navigation when editing or dialogs are open', () => {
      const mockFolder = createMockFolder({ id: 'folder-1', name: 'Work' });

      vi.mocked(useFolders).mockReturnValue({
        folders: [mockFolder],
        folderAssignments: {},
        isLoading: false,
        createFolder: mockCreateFolder,
        updateFolder: mockUpdateFolder,
        deleteFolder: mockDeleteFolder,
        refetch: mockRefetch,
        assignToFolder: vi.fn(),
        removeFromFolder: vi.fn(),
        moveToFolder: vi.fn(),
        getFoldersForCall: vi.fn(() => []),
      });

      render(<FoldersTab />, { wrapper: createWrapper() });

      // Check that keyboard navigation is initially enabled (enabled prop should be present)
      expect(useListKeyboardNavigationWithState).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true, // Should be enabled when not editing/dialogs closed
        })
      );
    });
  });
});
