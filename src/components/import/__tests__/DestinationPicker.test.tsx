import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock hooks
const mockWorkspaces = [
  { id: 'ws-1', name: 'Sales', organization_id: 'org-1', workspace_type: 'team', member_count: 3, user_role: 'workspace_owner' },
  { id: 'ws-2', name: 'Support', organization_id: 'org-1', workspace_type: 'team', member_count: 5, user_role: 'member' },
];

const mockFolders = [
  { id: 'f-1', name: 'Active Deals', user_id: 'u1', organization_id: 'org-1', parent_id: null, position: 0, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'f-2', name: 'Archive', user_id: 'u1', organization_id: 'org-1', parent_id: null, position: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

vi.mock('@/hooks/useWorkspaces', () => ({
  useOrganizationWorkspaces: vi.fn((orgId: string) => ({
    workspaces: orgId ? mockWorkspaces : [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/useFolders', () => ({
  useFolders: vi.fn((workspaceId: string | null) => ({
    data: workspaceId ? mockFolders : [],
    isLoading: false,
  })),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: vi.fn(() => ({
    data: [{ id: 'org-1', name: 'My Org' }], // single org = no org selector
    isLoading: false,
  })),
}));

// Import after mocking
import { DestinationPicker } from '../DestinationPicker';
import { useOrganizationWorkspaces } from '@/hooks/useWorkspaces';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('DestinationPicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call useOrganizationWorkspaces with the orgId prop', () => {
    render(
      <DestinationPicker
        value={null}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(useOrganizationWorkspaces).toHaveBeenCalledWith('org-1');
  });

  it('should render workspace options from hook data', () => {
    render(
      <DestinationPicker
        value={null}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const workspaceSelect = screen.getByLabelText('Select workspace');
    expect(workspaceSelect).toBeInTheDocument();

    // Check workspace options exist
    const options = workspaceSelect.querySelectorAll('option');
    // 1 placeholder + 2 workspaces = 3
    expect(options).toHaveLength(3);
    expect(options[1].textContent).toBe('Sales');
    expect(options[2].textContent).toBe('Support');
  });

  it('should call onChange when selecting a workspace', () => {
    render(
      <DestinationPicker
        value={null}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const workspaceSelect = screen.getByLabelText('Select workspace');
    fireEvent.change(workspaceSelect, { target: { value: 'ws-1' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      folderId: null,
      targetOrganizationId: null,
    });
  });

  it('should show folder picker after workspace selection', () => {
    render(
      <DestinationPicker
        value={{ workspaceId: 'ws-1', folderId: null, targetOrganizationId: null }}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const folderSelect = screen.getByLabelText('Select folder (optional)');
    expect(folderSelect).toBeInTheDocument();

    const options = folderSelect.querySelectorAll('option');
    // 1 placeholder ("No folder (root)") + 2 folders = 3
    expect(options).toHaveLength(3);
    expect(options[1].textContent).toBe('Active Deals');
    expect(options[2].textContent).toBe('Archive');
  });

  it('should call onChange with folderId when selecting a folder', () => {
    render(
      <DestinationPicker
        value={{ workspaceId: 'ws-1', folderId: null, targetOrganizationId: null }}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const folderSelect = screen.getByLabelText('Select folder (optional)');
    fireEvent.change(folderSelect, { target: { value: 'f-1' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      folderId: 'f-1',
      targetOrganizationId: null,
    });
  });

  it('should set folderId to null when "No folder (root)" is selected', () => {
    render(
      <DestinationPicker
        value={{ workspaceId: 'ws-1', folderId: 'f-1', targetOrganizationId: null }}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const folderSelect = screen.getByLabelText('Select folder (optional)');
    fireEvent.change(folderSelect, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      folderId: null,
      targetOrganizationId: null,
    });
  });

  it('should not show folder picker before workspace is selected', () => {
    render(
      <DestinationPicker
        value={null}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByLabelText('Select folder (optional)')).not.toBeInTheDocument();
  });

  it('should disable selects when disabled prop is true', () => {
    render(
      <DestinationPicker
        value={{ workspaceId: 'ws-1', folderId: null, targetOrganizationId: null }}
        onChange={mockOnChange}
        orgId="org-1"
        disabled
      />,
      { wrapper: createWrapper() }
    );

    const workspaceSelect = screen.getByLabelText('Select workspace');
    expect(workspaceSelect).toBeDisabled();

    const folderSelect = screen.getByLabelText('Select folder (optional)');
    expect(folderSelect).toBeDisabled();
  });

  it('should not show org selector when user has only one org', () => {
    render(
      <DestinationPicker
        value={null}
        onChange={mockOnChange}
        orgId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByLabelText('Select organization')).not.toBeInTheDocument();
  });
});
