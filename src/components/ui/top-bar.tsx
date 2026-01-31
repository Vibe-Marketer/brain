import React, { useEffect } from 'react';
import { RiSearchLine, RiSettings3Line, RiLogoutBoxRLine } from '@remixicon/react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { dispatchFocusInlineSearch } from '@/stores/searchStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BankSwitcher } from '@/components/header/BankSwitcher';
interface TopBarProps {
  pageLabel: string;
  searchEnabled?: boolean;
  onSearchClick?: () => void;
  className?: string;
}
export function TopBar({
  pageLabel,
  searchEnabled = true,
  onSearchClick,
  className
}: TopBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Handle search click - use custom handler if provided, otherwise focus inline search
  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      // Focus the inline search on the current page
      dispatchFocusInlineSearch();
    }
  };

  // Handle Cmd/Ctrl+K keyboard shortcut to focus inline search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus inline search on the current page
        dispatchFocusInlineSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  
  return <header
      className={cn(
        "h-[52px] fixed top-0 left-0 right-0 z-40",
        "flex items-center justify-between px-3 md:px-6",
        "bg-transparent",
        className
      )}
    >
      {/* Left: Logo/Branding - CallVault™ wordmark */}
      <button onClick={() => navigate('/')} className="flex items-center hover:opacity-80 transition-opacity">
        {/* Light mode: SVG with transparent background */}
        <img
          src="/cv-wordmark.svg"
          alt="CallVault™"
          className="h-8 md:h-10 w-auto object-contain dark:hidden"
        />
        {/* Dark mode: PNG version has transparent background */}
        <img
          src="/cv-wordmark.png"
          alt="CallVault™"
          className="h-8 md:h-10 w-auto object-contain hidden dark:block"
        />
      </button>

      {/* Center: Page Label - Vibe Orange */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="font-display uppercase tracking-[0.06em] text-vibe-orange font-extrabold text-sm md:text-lg">
          {pageLabel}
        </span>
      </div>

      {/* Right: Utilities */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Bank Switcher - shows current bank/vault context */}
        <BankSwitcher />
        
        {searchEnabled && <Button variant="hollow" size="icon" onClick={handleSearchClick} className="text-muted-foreground" aria-label="Search (Cmd+K)">
            <RiSearchLine className="w-4 h-4" />
          </Button>}

        <NotificationBell />

        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="w-7 h-7 md:w-8 md:h-8 cursor-pointer">
              <AvatarFallback className="bg-muted text-[10px] md:text-xs">
                {getInitials(user?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background border-border z-50">
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <RiSettings3Line className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
              <RiLogoutBoxRLine className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
}