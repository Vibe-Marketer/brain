import { useState } from 'react';
import { 
  RiHome6Line, 
  RiTimeLine, 
  RiTeamLine, 
  RiSearchLine, 
  RiNotification4Line,
  RiAddLine,
  RiSettings3Line
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-10 h-10 rounded-xl transition-all duration-200",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            onClick={onClick}
          >
            <Icon className="w-5 h-5" />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PrimarySidebar() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex flex-col items-center w-[60px] py-4 bg-background border-r border-border/40">
      {/* App Logo / Home */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          {/* Placeholder Logo */}
          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">CV</span>
          </div>
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        <NavItem 
          icon={RiAddLine} 
          label="New" 
          onClick={() => {}} 
        />
        <div className="h-px bg-border/40 my-2 mx-2" />
        
        <NavItem 
          icon={RiHome6Line} 
          label="Home" 
          isActive={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavItem 
          icon={RiTimeLine} 
          label="Recent" 
          isActive={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
        />
        <NavItem 
          icon={RiTeamLine} 
          label="Teams" 
          isActive={activeTab === 'teams'}
          onClick={() => setActiveTab('teams')}
        />
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-2 w-full px-2 mt-auto">
        <NavItem 
          icon={RiSearchLine} 
          label="Search" 
          onClick={() => {}} 
        />
        <NavItem 
          icon={RiNotification4Line} 
          label="Notifications" 
          onClick={() => {}} 
        />
        
        <div className="h-px bg-border/40 my-2 mx-2" />
        
        <NavItem 
          icon={RiSettings3Line} 
          label="Settings" 
          onClick={() => {}} 
        />
        
        {/* User Avatar Placeholder */}
        <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mt-2 hover:ring-2 ring-primary/20 transition-all">
          <span className="text-xs font-medium text-muted-foreground">AN</span>
        </button>
      </div>
    </aside>
  );
}
