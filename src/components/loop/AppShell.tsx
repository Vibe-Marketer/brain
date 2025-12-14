/**
 * AppShell Component
 * 
 * Microsoft Loop-inspired application shell with:
 * - Top navigation bar
 * - Left sidebar navigation
 * - Main content area
 * - Optional right panel
 */

import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Hide sidebar on login page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/oauth/callback';

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <TopBar 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className="flex h-[calc(100vh-52px)] pt-[52px]">
        {/* Left Sidebar - Hidden on auth pages */}
        {!isAuthPage && (
          <Sidebar 
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
          />
        )}

        {/* Main Content Area */}
        <main 
          className={cn(
            "flex-1 overflow-auto transition-all duration-300",
            !isAuthPage && !sidebarCollapsed && "ml-[240px]",
            !isAuthPage && sidebarCollapsed && "ml-[64px]"
          )}
        >
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
