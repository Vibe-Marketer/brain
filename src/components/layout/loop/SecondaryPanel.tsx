import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SecondaryPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  action?: React.ReactNode;
}

export function SecondaryPanel({ children, title, className, action }: SecondaryPanelProps) {
  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-muted/30 border-r border-border/40",
        "w-[280px] min-w-[240px] max-w-[320px]", // Fixed width for now, resizable logic can come later
        className
      )}
    >
      {/* Panel Header */}
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 h-[60px] flex-shrink-0">
          {title && (
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}

      {/* Panel Content (Scrollable) */}
      <ScrollArea className="flex-1">
        <div className="px-3 pb-4">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
