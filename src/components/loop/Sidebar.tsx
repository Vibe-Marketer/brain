/**
 * Sidebar Component
 * 
 * Left navigation sidebar with:
 * - Quick access links (Home, Recent, Favorites)
 * - Workspaces list
 * - Intelligence tools
 * - Settings
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  RiHome5Line,
  RiTimeLine,
  RiLightbulbLine,
  RiStarLine,
  RiFolderLine,
  RiBriefcaseLine,
  RiGraduationCapLine,
  RiTargetLine,
  RiCustomerService2Line,
  RiAddLine,
  RiBrainLine,
  RiBarChartLine,
  RiBookLine,
  RiPriceTag3Line,
  RiSettings4Line,
  RiPlugLine,
  RiArrowLeftSLine,
  RiArrowRightSLine
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

interface WorkspaceItem {
  id: string;
  label: string;
  emoji: string;
  path: string;
  count?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const location = useLocation();

  const quickLinks: NavItem[] = [
    { label: 'Home', icon: RiHome5Line, path: '/' },
    { label: 'Recent', icon: RiTimeLine, path: '/recent' },
    { label: 'Ideas', icon: RiLightbulbLine, path: '/ideas' },
    { label: 'Favorites', icon: RiStarLine, path: '/favorites' },
  ];

  const workspaces: WorkspaceItem[] = [
    { id: '1', label: 'Sales Calls', emoji: '💼', path: '/workspace/sales', count: 23 },
    { id: '2', label: 'Coaching', emoji: '🎓', path: '/workspace/coaching', count: 15 },
    { id: '3', label: 'Demos', emoji: '🎯', path: '/workspace/demos', count: 8 },
    { id: '4', label: 'Support', emoji: '💬', path: '/workspace/support', count: 31 },
  ];

  const intelligenceLinks: NavItem[] = [
    { label: 'AI Insights', icon: RiBrainLine, path: '/insights', badge: 5 },
    { label: 'Analytics', icon: RiBarChartLine, path: '/analytics' },
    { label: 'Library', icon: RiBookLine, path: '/library' },
    { label: 'Tags', icon: RiPriceTag3Line, path: '/tags' },
  ];

  const settingsLinks: NavItem[] = [
    { label: 'Settings', icon: RiSettings4Line, path: '/settings' },
    { label: 'Integrations', icon: RiPlugLine, path: '/integrations' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <Link
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          active && "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
          !active && "text-gray-700 dark:text-gray-300"
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-600 rounded-r-full" />
        )}
        <Icon className={cn("w-5 h-5 flex-shrink-0", collapsed && "mx-auto")} />
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-orange-500 text-white rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  const WorkspaceLink = ({ workspace }: { workspace: WorkspaceItem }) => {
    const active = isActive(workspace.path);

    return (
      <Link
        to={workspace.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          active && "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
          !active && "text-gray-700 dark:text-gray-300"
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-600 rounded-r-full" />
        )}
        <span className={cn("text-lg flex-shrink-0", collapsed && "mx-auto")}>
          {workspace.emoji}
        </span>
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1">{workspace.label}</span>
            {workspace.count && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {workspace.count}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-[52px] h-[calc(100vh-52px)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-40",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      <ScrollArea className="h-full">
        <div className="p-3 space-y-6">
          {/* Quick Links */}
          <nav className="space-y-1">
            {quickLinks.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>

          <Separator />

          {/* Workspaces */}
          <div>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Workspaces
              </h3>
            )}
            <nav className="space-y-1">
              {workspaces.map((workspace) => (
                <WorkspaceLink key={workspace.id} workspace={workspace} />
              ))}
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                  "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                )}
              >
                <RiAddLine className={cn("w-5 h-5 flex-shrink-0", collapsed && "mx-auto")} />
                {!collapsed && <span className="text-sm font-medium">New Workspace</span>}
              </button>
            </nav>
          </div>

          <Separator />

          {/* Intelligence */}
          <div>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Intelligence
              </h3>
            )}
            <nav className="space-y-1">
              {intelligenceLinks.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </nav>
          </div>

          <Separator />

          {/* Settings */}
          <nav className="space-y-1">
            {settingsLinks.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>
        </div>
      </ScrollArea>

      {/* Collapse Toggle */}
      <button
        onClick={() => onCollapse(!collapsed)}
        className={cn(
          "absolute bottom-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800",
          "hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
          "text-gray-700 dark:text-gray-300"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <RiArrowRightSLine className="w-4 h-4" />
        ) : (
          <RiArrowLeftSLine className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
};
