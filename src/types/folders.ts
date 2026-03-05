/**
 * Folder type definitions - Unified with Workspace Redesign (Phase 16)
 *
 * This file now re-exports the Folder interface from workspace.ts to ensure
 * a single source of truth across V1 and V2 components.
 */

export type { Folder, FolderAssignment } from './workspace'

// Extended type for UI components that need depth calculation
import type { Folder as BaseFolder } from './workspace'
export interface FolderWithDepth extends BaseFolder {
  depth?: number;
}
