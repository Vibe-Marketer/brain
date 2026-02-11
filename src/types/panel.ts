/**
 * Panel type definitions for the panelStore
 * 
 * Uses discriminated union pattern for type-safe panel data
 */

/**
 * All possible panel types
 */
export type PanelType =
  | 'workspace-detail'
  | 'call-detail'
  | 'insight-detail'
  | 'filter-tool'
  | 'ai-assistant'
  | 'inspector'
  | 'folder-detail'
  | 'tag-detail'
  | 'setting-help'
  | 'settings'
  | 'sorting'
  | 'user-detail'
  | 'bulk-actions'
  | 'vault-member'
  | null;

/**
 * Discriminated union for type-safe panel data
 * Each panel type has its own specific data shape
 */
export type PanelData =
  | { type: 'call-detail'; recordingId: number; title?: string }
  | { type: 'folder-detail'; folderId: string }
  | { type: 'tag-detail'; tagId: string }
  | { type: 'user-detail'; userId: string; onUserUpdated?: () => void }
  | { type: 'workspace-detail'; workspaceId: string }
  | { type: 'bulk-actions'; selectedIds: string[] }
  | { type: 'setting-help'; topic?: string }
  | { type: 'settings'; tab?: string }
  | { type: 'insight-detail'; insightId: string }
  | { type: 'filter-tool' }
  | { type: 'ai-assistant' }
  | { type: 'inspector' }
  | { type: 'sorting' }
  | { type: 'vault-member'; vaultId: string }
  | null;

/**
 * History entry for panel navigation
 */
export interface PanelHistoryEntry {
  type: PanelType;
  data: PanelData;
}

/**
 * Extract the data type for a specific panel type
 * 
 * @example
 * type CallDetailData = ExtractPanelData<'call-detail'>;
 * // { type: 'call-detail'; recordingId: number; title?: string }
 */
export type ExtractPanelData<T extends NonNullable<PanelType>> = 
  Extract<NonNullable<PanelData>, { type: T }>;
