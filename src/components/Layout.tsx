import { MacOSDock, DockApp } from "@/components/ui/mac-os-dock";
import { TopBar } from "@/components/ui/top-bar";
import { useNavigate, useLocation } from "react-router-dom";
import { RiHome4Fill, RiChat1Fill, RiPriceTag3Fill, RiSettings3Fill } from "@remixicon/react";

// Glossy 3D dock icon wrapper - white version of primary button effect
const DockIcon = ({ children }: { children: React.ReactNode }) => (
  <div
    className="w-full h-full flex items-center justify-center rounded-xl"
    style={{
      background: 'linear-gradient(160deg, #FFFFFF 0%, #E8E8E8 100%)',
      border: '1px solid rgba(200, 200, 200, 0.8)',
      boxShadow: `
        0 4px 6px rgba(255, 255, 255, 0.5) inset,
        0 -4px 6px rgba(0, 0, 0, 0.08) inset,
        0 10px 20px rgba(0, 0, 0, 0.08)
      `,
    }}
  >
    {children}
  </div>
);

function LayoutContent({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const dockApps: DockApp[] = [
    {
      id: 'home',
      name: 'Home',
      icon: <DockIcon><RiHome4Fill className="w-6 h-6 text-cb-black" /></DockIcon>,
      onClick: () => navigate('/'),
    },
    {
      id: 'chat',
      name: 'AI Chat',
      icon: <DockIcon><RiChat1Fill className="w-6 h-6 text-cb-black" /></DockIcon>,
      onClick: () => navigate('/chat'),
    },
    {
      id: 'categorization',
      name: 'Tags',
      icon: <DockIcon><RiPriceTag3Fill className="w-6 h-6 text-cb-black" /></DockIcon>,
      onClick: () => navigate('/categorization'),
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <DockIcon><RiSettings3Fill className="w-6 h-6 text-cb-black" /></DockIcon>,
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
