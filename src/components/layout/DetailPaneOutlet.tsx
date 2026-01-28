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
        return panelData?.folderId ? (
          <FolderDetailPanel folderId={panelData.folderId} />
        ) : null;

      case 'tag-detail':
        return panelData?.tagId ? (
          <TagDetailPanel tagId={panelData.tagId} />
        ) : null;

      case 'setting-help':
        return <SettingHelpPanel />;

      case 'user-detail':
        return panelData?.userId ? (
          <UserDetailPanel
            userId={panelData.userId}
            onUserUpdated={panelData?.onUserUpdated}
          />
        ) : null;

      case 'call-detail':
        return panelData?.recordingId ? (
          <CallDetailPanel recordingId={panelData.recordingId} />
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
        "transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
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
