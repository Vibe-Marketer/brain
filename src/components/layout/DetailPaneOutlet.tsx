/**
 * DetailPaneOutlet - Centralized detail panel renderer
 *
 * Renders the appropriate detail panel based on the panelStore state.
 * Provides consistent animation and styling for all panel types.
 *
 * ## Design Specification
 * - **Animation**: Slides in from right with opacity + transform
 * - **Width**: 360px (desktop), 320px (tablet)
 * - **Transition**: 300ms cubic-bezier easing
 * - **Integration**: Reads from panelStore for panel type/data
 *
 * @pattern detail-pane-outlet
 * @brand-version v4.1
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePanelStore } from '@/stores/panelStore';

// Import panel components
import { FolderDetailPanel } from '@/components/panels/FolderDetailPanel';
import { TagDetailPanel } from '@/components/panels/TagDetailPanel';
import { SettingHelpPanel } from '@/components/panels/SettingHelpPanel';
import { UserDetailPanel } from '@/components/panels/UserDetailPanel';
import { CallDetailPanel } from '@/components/panels/CallDetailPanel';
import { WorkspaceMemberPanel } from '@/components/panels/WorkspaceMemberPanel';
import { OrganizationMemberPanel } from '@/components/panels/OrganizationMemberPanel';
import { AutomationRulePanel } from '@/components/panels/AutomationRulePanel';
import { RoutingRulePanel } from '@/components/panels/RoutingRulePanel';
import { WorkspaceDetailPanel } from '@/components/panels/WorkspaceDetailPanel';
import { BulkActionToolbarEnhanced } from '@/components/transcript-library/BulkActionToolbarEnhanced';

export interface DetailPaneOutletProps {
  /** Whether we're on tablet breakpoint (affects width) */
  isTablet?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Centralized outlet for detail panels
 *
 * Automatically renders the correct panel component based on
 * panelStore.panelType and handles animation states.
 *
 * Supported panel types:
 * - 'folder-detail': FolderDetailPanel
 * - 'tag-detail': TagDetailPanel
 * - 'setting-help': SettingHelpPanel
 * - 'user-detail': UserDetailPanel
 *
 * @example
 * ```tsx
 * <DetailPaneOutlet isTablet={isTablet} />
 * ```
 */
export function DetailPaneOutlet({
  isTablet = false,
  className
}: DetailPaneOutletProps) {
  const { isPanelOpen, panelType, panelData } = usePanelStore();

  // Determine which panel to render
  const renderPanel = () => {
    if (!isPanelOpen || !panelType) return null;

    switch (panelType) {
      case 'folder-detail':
        return panelData?.type === 'folder-detail' ? (
          <FolderDetailPanel folderId={panelData.folderId} />
        ) : null;

      case 'tag-detail':
        return panelData?.type === 'tag-detail' ? (
          <TagDetailPanel tagId={panelData.tagId} />
        ) : null;

      case 'setting-help':
        return <SettingHelpPanel />;

      case 'user-detail':
        return panelData?.type === 'user-detail' ? (
          <UserDetailPanel
            userId={panelData.userId}
            onUserUpdated={panelData.onUserUpdated}
          />
        ) : null;

      case 'call-detail':
        return panelData?.type === 'call-detail' ? (
          <CallDetailPanel recordingId={panelData.recordingId} />
        ) : null;

      case 'workspace-detail':
        return panelData?.type === 'workspace-detail' ? (
          <WorkspaceDetailPanel workspaceId={panelData.workspaceId} />
        ) : null;

      case 'workspace_members':
        if (panelData?.type === 'workspace_members') {
          return <WorkspaceMemberPanel workspaceId={panelData.workspaceId} workspaceName={panelData.workspaceName || ''} />;
        }
        return null;

      case 'organization_members':
        if (panelData?.type === 'organization_members') {
          return <OrganizationMemberPanel organizationId={panelData.organizationId} organizationName={panelData.organizationName || ''} />;
        }
        return null;

      case 'automation-rule':
        return panelData?.type === 'automation-rule' ? (
          <AutomationRulePanel ruleId={panelData.ruleId} />
        ) : null;
        
      case 'routing-rule':
        return panelData?.type === 'routing-rule' ? (
          <RoutingRulePanel ruleId={panelData.ruleId} />
        ) : null;

      case 'bulk-actions':
        return panelData?.type === 'bulk-actions' ? (
          <BulkActionToolbarEnhanced
            selectedCount={panelData.selectedIds.length}
            selectedCalls={panelData.selectedCalls || []}
            tags={panelData.tags || []}
            onClearSelection={() => {
              if (panelData.onClearSelection) panelData.onClearSelection();
            }}
            onDelete={() => {
              if (panelData.onDelete) panelData.onDelete();
            }}
            onTag={panelData.onTag}
            onRemoveTag={panelData.onRemoveTag}
            onCreateNewTag={panelData.onCreateNewTag}
            onAssignFolder={panelData.onAssignFolder}
            deleteLabel={panelData.deleteLabel}
            currentWorkspaceId={panelData.currentWorkspaceId}
          />
        ) : null;

      default:
        // Unsupported panel type
        console.warn(`DetailPaneOutlet: Unsupported panel type "${panelType}"`);
        return null;
    }
  };

  // Determine ARIA label based on panel type
  const getAriaLabel = () => {
    switch (panelType) {
      case 'folder-detail':
        return 'Folder detail panel';
      case 'tag-detail':
        return 'Tag detail panel';
      case 'setting-help':
        return 'Settings help panel';
      case 'user-detail':
        return 'User detail panel';
      case 'call-detail':
        return 'Call detail panel';
      case 'workspace_members':
        return 'Workspace member panel';
      case 'organization_members':
        return 'Organization member panel';
      case 'automation-rule':
        return 'Automation rule detail panel';
      case 'routing-rule':
        return 'Routing rule panel';
      case 'bulk-actions':
        return 'Bulk actions panel';
      default:
        return 'Detail panel';
    }
  };

  return (
    <aside
      role="complementary"
      aria-label={getAriaLabel()}
      aria-hidden={!isPanelOpen}
      tabIndex={isPanelOpen ? 0 : -1}
      className={cn(
        // Base styles
        "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm",
        "flex flex-col h-full z-10 overflow-hidden",
        // Transition: Width, opacity, and transform animate together
        "transition-[width,opacity,transform] duration-500 ease-in-out",
        "will-change-[width,transform]",
        // Focus states
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
        // Visibility states
        isPanelOpen
          ? [
              // Open state: Full width, visible, no transform
              isTablet ? "w-[320px]" : "w-[360px]",
              "opacity-100 translate-x-0"
            ]
          : [
              // Closed state: Collapsed, hidden, translated right
              "w-0 opacity-0 translate-x-4 border-0"
            ],
        className
      )}
    >
      {renderPanel()}
    </aside>
  );
}
