/**
 * TopBar Component
 * 
 * Top navigation bar with:
 * - Logo and branding
 * - Universal search
 * - Sync status
 * - Notifications
 * - User menu
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  RiSearchLine, 
  RiBellLine, 
  RiUserLine, 
  RiSettings4Line,
  RiLogoutBoxLine,
  RiMenuLine,
  RiRefreshLine,
  RiCheckLine
} from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement search functionality
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Menu Toggle */}
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <RiMenuLine className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CV</span>
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white hidden sm:block">
              CallVault
            </span>
          </Link>
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-2xl mx-8">
          <form onSubmit={handleSearch} className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search calls, insights, content..."
              className={cn(
                "pl-10 pr-4 h-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
                "focus:bg-white dark:focus:bg-gray-900 transition-all",
                searchFocused && "ring-2 ring-purple-500"
              )}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </form>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Sync Status */}
          <button
            onClick={() => setSyncing(!syncing)}
            className={cn(
              "p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative",
              syncing && "animate-spin"
            )}
            aria-label="Sync status"
          >
            {syncing ? (
              <RiRefreshLine className="w-5 h-5 text-purple-600" />
            ) : (
              <RiCheckLine className="w-5 h-5 text-green-600" />
            )}
          </button>

          {/* Notifications */}
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <RiBellLine className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
          </button>

          {/* Invite Button */}
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 text-white hidden md:flex"
          >
            Invite
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-purple-600 text-white text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.user_metadata?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <RiSettings4Line className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <RiUserLine className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <RiLogoutBoxLine className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
