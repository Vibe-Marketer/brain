import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PrimarySidebar } from './PrimarySidebar';
import { SecondaryPanel } from './SecondaryPanel';
import { usePanelStore } from '@/stores/panelStore';

/**
 * AppShellV2 - Microsoft Loop-inspired layout with contextual panels
 * 
 * Layout: [Primary Sidebar 64px] [Secondary Panel 280px] [Main Content Flexible]
 * 
 * - Primary sidebar is always visible, icon-based navigation
 * - Secondary panel slides in/out adjacent to primary sidebar
 * - Main content area never obscured by panels
 * - Panels are contextual to primary sidebar selection
 */
export function AppShellV2() {
  const { 
    isPanelOpen, 
    panelType, 
    panelData,
    isPinned 
  } = usePanelStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Primary Sidebar - Always visible, 64px wide */}
      <PrimarySidebar />

      {/* Secondary Panel - Slides in from right of sidebar, 280px wide */}
      <div 
        className={`
          transition-all duration-300 ease-in-out
          ${isPanelOpen ? 'w-[280px]' : 'w-0'}
          overflow-hidden
        `}
      >
        {isPanelOpen && (
          <SecondaryPanel 
            type={panelType}
            data={panelData}
            isPinned={isPinned}
          />
        )}
      </div>

      {/* Main Content Area - Flexible width, never obscured */}
      <main className="flex-1 overflow-auto bg-white">
        <Outlet />
      </main>
    </div>
  );
}
