import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MainLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function MainLayout({ children, header, className }: MainLayoutProps) {
  return (
    <main 
      className={cn(
        "flex-1 flex flex-col min-w-0 bg-background h-screen",
        className
      )}
    >
      {/* Main Header */}
      {header && (
        <header className="flex-shrink-0 h-[60px] flex items-center px-6 border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          {header}
        </header>
      )}

      {/* Main Workspace Canvas */}
      <ScrollArea className="flex-1">
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </ScrollArea>
    </main>
  );
}
