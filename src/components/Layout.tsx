/**
 * Layout - Top-level layout wrapper
 *
 * Provides:
 * - Viewport background with brand gradient
 * - TopBar navigation header
 * - Main content area (no card wrapper - pages handle their own layout)
 *
 * All pages now use AppShell for the 3-pane architecture.
 * The legacy card wrapper has been removed - pages that need card
 * styling should add it themselves.
 */

import { TopBar } from "@/components/ui/top-bar";
import { useLocation } from "react-router-dom";
import { DebugPanel } from "@/components/debug-panel";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const getPageLabel = () => {
    if (location.pathname === '/') return 'HOME';
    if (location.pathname.startsWith('/chat')) return 'AI CHAT';
    if (location.pathname.startsWith('/sorting-tagging')) return 'SORTING & TAGGING';
    if (location.pathname.startsWith('/settings')) return 'SETTINGS';
    if (location.pathname === '/shared-with-me') return 'SHARED WITH ME';
    if (location.pathname.startsWith('/vaults')) return 'VAULTS';
    if (location.pathname.startsWith('/content')) return 'CONTENT HUB';
    return 'HOME';
  };

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 235, 0, 0.12) 0%, rgba(255, 136, 0, 0.08) 50%, rgba(255, 61, 0, 0.05) 100%), hsl(var(--viewport))'
      }}
    >
      <TopBar pageLabel={getPageLabel()} />
      <main className="fixed inset-2.5 top-[52px]">
        {children}
      </main>
      <DebugPanel />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
