import { TopBar } from "@/components/ui/top-bar";
import { useLocation } from "react-router-dom";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const getPageLabel = () => {
    if (location.pathname === '/') return 'HOME';
    if (location.pathname.startsWith('/chat')) return 'AI CHAT';
    if (location.pathname.startsWith('/sorting-tagging')) return 'SORTING & TAGGING';
    if (location.pathname.startsWith('/settings')) return 'SETTINGS';
    return 'HOME';
  };

  // Pages that provide their own container/layout (no card wrapper)
  const isChatPage = location.pathname.startsWith('/chat');
  const isTranscriptsPage = location.pathname === '/' || location.pathname === '/transcripts';
  const isSortingPage = location.pathname.startsWith('/sorting-tagging');
  const isSettingsPage = location.pathname.startsWith('/settings');
  const usesCustomLayout = isChatPage || isTranscriptsPage || isSortingPage || isSettingsPage;

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 235, 0, 0.12) 0%, rgba(255, 136, 0, 0.08) 50%, rgba(255, 61, 0, 0.05) 100%), hsl(var(--viewport))'
      }}
    >
      <TopBar pageLabel={getPageLabel()} />
      <main className="fixed inset-2.5 top-[52px]">
        {usesCustomLayout ? (
          // Chat and Transcripts pages provide their own layout - no wrapper
          children
        ) : (
          // Other pages get the standard card wrapper
          <div className="bg-card rounded-2xl px-4 md:px-10 pb-20 md:pb-10 pt-2 shadow-lg border border-border h-full overflow-auto">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
