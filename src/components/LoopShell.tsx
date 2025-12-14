import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  RiHome5Line,
  RiFolderLine,
  RiLightbulbLine,
  RiPhoneLine,
  RiBarChartLine,
  RiSettings3Line,
  RiPushpinLine,
  RiCloseLine,
  RiSearchLine,
  RiFilterLine,
  RiUserLine,
} from '@remixicon/react';

interface PanelConfig {
  type: 'workspace-detail' | 'filter-tool' | 'ai-assistant' | 'inspector' | null;
  data?: any;
}

export function LoopShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [currentPanel, setCurrentPanel] = useState<PanelConfig>({ type: null });

  // Determine which panel to show based on route
  useEffect(() => {
    const path = location.pathname;
    
    if (path.startsWith('/workspaces')) {
      setCurrentPanel({ type: 'workspace-detail' });
      setIsPanelOpen(true);
    } else if (path === '/' || path.startsWith('/calls')) {
      setCurrentPanel({ type: 'filter-tool' });
      setIsPanelOpen(true);
    } else if (path.startsWith('/insights')) {
      setCurrentPanel({ type: 'filter-tool' });
      setIsPanelOpen(true);
    } else if (!isPinned) {
      setIsPanelOpen(false);
    }
  }, [location.pathname, isPinned]);

  const togglePin = () => {
    setIsPinned(!isPinned);
  };

  const closePanel = () => {
    if (!isPinned) {
      setIsPanelOpen(false);
    }
  };

  const navItems = [
    { icon: RiHome5Line, label: 'Home', path: '/', key: 'home' },
    { icon: RiFolderLine, label: 'Workspaces', path: '/workspaces', key: 'workspaces' },
    { icon: RiLightbulbLine, label: 'Insights', path: '/insights', key: 'insights' },
    { icon: RiPhoneLine, label: 'Calls', path: '/calls', key: 'calls' },
    { icon: RiBarChartLine, label: 'Analytics', path: '/analytics', key: 'analytics' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen w-full bg-viewport overflow-hidden">
      {/* Primary Sidebar - 64px, always visible */}
      <aside className="w-16 bg-card border-r border-border flex flex-col flex-shrink-0 z-50">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFEB00] via-[#FF8800] to-[#FF3D00] flex items-center justify-center shadow-lg">
            <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'group relative w-full h-12 flex items-center justify-center rounded-lg transition-all',
                    active
                      ? 'bg-hover'
                      : 'hover:bg-hover'
                  )}
                  title={item.label}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-vibe-orange rounded-r" />
                  )}
                  <Icon className={cn(
                    'w-6 h-6 transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )} />
                  
                  {/* Tooltip */}
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* System Navigation */}
        <div className="border-t border-border py-4 px-2">
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              'group relative w-full h-12 flex items-center justify-center rounded-lg transition-all',
              location.pathname === '/settings'
                ? 'bg-hover'
                : 'hover:bg-hover'
            )}
            title="Settings"
          >
            <RiSettings3Line className="w-6 h-6 text-muted-foreground" />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
              Settings
            </div>
          </button>
        </div>
      </aside>

      {/* Secondary Panel - 280px, slides in/out */}
      <div
        className={cn(
          'bg-card border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
          isPanelOpen ? 'w-[280px]' : 'w-0'
        )}
      >
        {isPanelOpen && currentPanel.type && (
          <div className="w-[280px] h-full flex flex-col">
            {/* Panel Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">
                {currentPanel.type === 'workspace-detail' && 'Workspace'}
                {currentPanel.type === 'filter-tool' && 'Filters'}
                {currentPanel.type === 'ai-assistant' && 'AI Assistant'}
                {currentPanel.type === 'inspector' && 'Inspector'}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={togglePin}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isPinned
                      ? 'bg-[#FF8800]/10 text-vibe-orange'
                      : 'hover:bg-hover text-muted-foreground'
                  )}
                  title={isPinned ? 'Unpin panel' : 'Pin panel'}
                >
                  <RiPushpinLine className="w-4 h-4" />
                </button>
                <button
                  onClick={closePanel}
                  className="p-1.5 hover:bg-hover rounded-lg transition-colors text-muted-foreground"
                  title="Close panel"
                  disabled={isPinned}
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {currentPanel.type === 'workspace-detail' && <WorkspaceDetailPanel />}
              {currentPanel.type === 'filter-tool' && <FilterToolPanel />}
              {currentPanel.type === 'ai-assistant' && <AIAssistantPanel />}
              {currentPanel.type === 'inspector' && <InspectorPanel />}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - flexible width */}
      <main className="flex-1 overflow-auto bg-viewport">
        {children}
      </main>
    </div>
  );
}

// Panel Components
function WorkspaceDetailPanel() {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🚀</div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Product Discovery</h3>
            <p className="text-xs text-muted-foreground">Updated 2 hours ago</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-viewport rounded-lg p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Members</div>
          <div className="text-2xl font-semibold text-foreground">5</div>
        </div>
        <div className="bg-viewport rounded-lg p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Calls</div>
          <div className="text-2xl font-semibold text-foreground">12</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Members</h4>
        {['Sarah Johnson', 'Mike Chen', 'Emma Davis'].map((name) => (
          <div key={name} className="flex items-center gap-3 p-2 hover:bg-hover rounded-lg transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF8800] to-[#FF3D00] flex items-center justify-center text-white text-xs font-medium">
              {name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">Editor</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterToolPanel() {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</label>
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:border-l-4 focus:border-l-vibe-orange bg-card text-foreground text-sm transition-all"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sort By</label>
        <select className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-l-4 focus:border-l-vibe-orange bg-card text-foreground text-sm transition-all">
          <option>Newest First</option>
          <option>Oldest First</option>
          <option>Name (A-Z)</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</label>
        {[
          { label: 'AI Processed', count: 24 },
          { label: 'Positive Sentiment', count: 18 },
          { label: 'Has Action Items', count: 15 },
        ].map((filter) => (
          <button
            key={filter.label}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-viewport border border-border hover:border-muted-foreground transition-colors text-left"
          >
            <span className="text-sm text-foreground">{filter.label}</span>
            <span className="text-xs text-muted-foreground">{filter.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AIAssistantPanel() {
  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-muted-foreground">
        AI Assistant panel content
      </div>
    </div>
  );
}

function InspectorPanel() {
  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-muted-foreground">
        Inspector panel content
      </div>
    </div>
  );
}
