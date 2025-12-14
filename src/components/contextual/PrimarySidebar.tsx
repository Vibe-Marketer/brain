import { useLocation, useNavigate } from 'react-router-dom';
import { 
  RiHome5Line, 
  RiFolderLine, 
  RiLightbulbLine, 
  RiPhoneLine,
  RiBarChartLine,
  RiBookmarkLine,
  RiRobot2Line,
  RiFlashlightLine,
  RiTeamLine,
  RiSettings3Line,
  RiQuestionLine,
  RiUserLine
} from '@remixicon/react';
import { usePanelStore } from '@/stores/panelStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  section: 'core' | 'intelligence' | 'system';
  panelType?: 'workspace-detail' | 'filter-tool' | null;
}

const navItems: NavItem[] = [
  // Core Navigation
  { id: 'home', label: 'Home', icon: RiHome5Line, path: '/', section: 'core' },
  { id: 'workspaces', label: 'Workspaces', icon: RiFolderLine, path: '/workspaces', section: 'core', panelType: 'workspace-detail' },
  { id: 'insights', label: 'Insights', icon: RiLightbulbLine, path: '/insights', section: 'core', panelType: 'filter-tool' },
  { id: 'calls', label: 'Calls', icon: RiPhoneLine, path: '/calls', section: 'core', panelType: 'filter-tool' },
  { id: 'analytics', label: 'Analytics', icon: RiBarChartLine, path: '/analytics', section: 'core' },
  { id: 'library', label: 'Library', icon: RiBookmarkLine, path: '/library', section: 'core' },
  
  // Intelligence Hub
  { id: 'ai-processing', label: 'AI Processing', icon: RiRobot2Line, path: '/ai-processing', section: 'intelligence' },
  { id: 'knowledge', label: 'Knowledge', icon: RiFlashlightLine, path: '/knowledge', section: 'intelligence' },
  { id: 'team', label: 'Team', icon: RiTeamLine, path: '/team', section: 'intelligence' },
  
  // System
  { id: 'settings', label: 'Settings', icon: RiSettings3Line, path: '/settings', section: 'system' },
  { id: 'help', label: 'Help', icon: RiQuestionLine, path: '/help', section: 'system' },
  { id: 'profile', label: 'Profile', icon: RiUserLine, path: '/profile', section: 'system' },
];

export function PrimarySidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openPanel, closePanel, isPinned } = usePanelStore();

  const handleNavClick = (item: NavItem) => {
    navigate(item.path);
    
    // Open contextual panel if defined
    if (item.panelType) {
      openPanel(item.panelType);
    } else if (!isPinned) {
      closePanel();
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const renderSection = (section: 'core' | 'intelligence' | 'system') => {
    const items = navItems.filter(item => item.section === section);
    
    return (
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`
                group relative w-full h-12 flex items-center justify-center
                transition-all duration-200
                ${active 
                  ? 'text-purple-600' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              title={item.label}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-600 rounded-r" />
              )}
              
              {/* Icon */}
              <Icon size={24} />
              
              {/* Tooltip on hover */}
              <div className="
                absolute left-full ml-2 px-2 py-1
                bg-gray-900 text-white text-xs rounded
                opacity-0 group-hover:opacity-100
                pointer-events-none transition-opacity
                whitespace-nowrap z-50
              ">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="w-16 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          CV
        </div>
      </div>

      {/* Core Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {renderSection('core')}
        
        {/* Divider */}
        <div className="h-px bg-gray-200 my-4 mx-2" />
        
        {/* Intelligence Hub */}
        {renderSection('intelligence')}
      </div>

      {/* System Navigation */}
      <div className="border-t border-gray-200 py-4">
        {renderSection('system')}
      </div>
    </aside>
  );
}
