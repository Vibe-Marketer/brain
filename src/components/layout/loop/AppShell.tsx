import { PrimarySidebar } from './PrimarySidebar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-background font-sans antialiased flex", className)}>
      {/* 1. Global Navigation Rail (Fixed) */}
      <PrimarySidebar />

      {/* 2. Content Area (Offset by Rail) */}
      <div className="flex-1 flex pl-[60px] min-w-0 transition-all duration-300 ease-in-out">
        {children}
      </div>
    </div>
  );
}
