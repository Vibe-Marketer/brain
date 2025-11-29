import { MacOSDock, DockApp } from "@/components/ui/mac-os-dock";
import { TopBar } from "@/components/ui/top-bar";
import { useNavigate, useLocation } from "react-router-dom";
import { RiChat1Fill, RiPriceTag3Fill } from "@remixicon/react";
import homeIcon from '@/assets/icons/home.svg';
import settingsIcon from '@/assets/icons/settings.svg';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const dockApps: DockApp[] = [
    {
      id: 'home',
      name: 'Home',
      icon: <img src={homeIcon} alt="Home" className="w-full h-full object-cover rounded-xl" />,
      onClick: () => navigate('/'),
    },
    {
      id: 'chat',
      name: 'AI Chat',
      icon: <div className="w-full h-full flex items-center justify-center rounded-xl bg-gradient-to-br from-cb-vibe-green/80 to-cb-vibe-green"><RiChat1Fill className="w-7 h-7 text-cb-ink-primary" /></div>,
      onClick: () => navigate('/chat'),
    },
    {
      id: 'categorization',
      name: 'Categories',
      icon: <div className="w-full h-full flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/80 to-purple-600"><RiPriceTag3Fill className="w-7 h-7 text-white" /></div>,
      onClick: () => navigate('/categorization'),
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <img src={settingsIcon} alt="Settings" className="w-full h-full object-cover rounded-xl" />,
      onClick: () => navigate('/settings'),
    },
  ];

  const getOpenApps = () => {
    const apps: string[] = [];
    if (location.pathname === '/') apps.push('home');
    if (location.pathname.startsWith('/chat')) apps.push('chat');
    if (location.pathname.startsWith('/categorization')) apps.push('categorization');
    if (location.pathname.startsWith('/settings')) apps.push('settings');
    return apps;
  };

  const getPageLabel = () => {
    if (location.pathname === '/') return 'HOME';
    if (location.pathname === '/chat') return 'AI CHAT';
    if (location.pathname === '/categorization') return 'CATEGORIES';
    if (location.pathname === '/settings') return 'SETTINGS';
    return 'HOME';
  };
  
  // Chat page provides its own container (ChatOuterCard), so we don't wrap it
  const isChatPage = location.pathname.startsWith('/chat');

  return (
    <div className="min-h-screen w-full bg-viewport relative">
      <TopBar pageLabel={getPageLabel()} />
      <main className="fixed inset-2 top-[52px]">
        {isChatPage ? (
          // Chat page uses ChatOuterCard directly - no wrapper
          children
        ) : (
          // Other pages get the standard card wrapper
          <div className="bg-card rounded-2xl px-4 md:px-10 pb-20 md:pb-10 pt-2 shadow-lg border border-border h-full overflow-auto">
            {children}
          </div>
        )}
      </main>
      <MacOSDock apps={dockApps} openApps={getOpenApps()} />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
