/**
 * WorkspacesHome Page
 * 
 * Main dashboard showing all workspaces in a grid layout
 * Microsoft Loop-inspired design
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RiAddLine, 
  RiGridLine, 
  RiListCheck, 
  RiArrowDownSLine 
} from '@remixicon/react';
import { WorkspaceCard, WORKSPACE_GRADIENTS } from '@/components/loop/WorkspaceCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterMode = 'recent' | 'favorites' | 'all';

export const WorkspacesHome: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('recent');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'members'>('updated');

  // Mock data - will be replaced with real data from Supabase
  const workspaces = [
    {
      id: '1',
      title: 'Sales Calls',
      emoji: '💼',
      memberCount: 12,
      callCount: 45,
      members: [
        { id: '1', name: 'Wanda', avatar: '' },
        { id: '2', name: 'Kat', avatar: '' },
        { id: '3', name: 'Colin', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      gradient: WORKSPACE_GRADIENTS[0],
      path: '/workspace/sales',
    },
    {
      id: '2',
      title: 'Coaching Sessions',
      emoji: '🎓',
      memberCount: 8,
      callCount: 23,
      members: [
        { id: '4', name: 'Daisy', avatar: '' },
        { id: '5', name: 'Elvia', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      gradient: WORKSPACE_GRADIENTS[1],
      path: '/workspace/coaching',
    },
    {
      id: '3',
      title: 'Product Demos',
      emoji: '🎯',
      memberCount: 15,
      callCount: 67,
      members: [
        { id: '6', name: 'Alex', avatar: '' },
        { id: '7', name: 'Sam', avatar: '' },
        { id: '8', name: 'Jordan', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      gradient: WORKSPACE_GRADIENTS[2],
      path: '/workspace/demos',
    },
    {
      id: '4',
      title: 'Customer Support',
      emoji: '💬',
      memberCount: 20,
      callCount: 134,
      members: [
        { id: '9', name: 'Taylor', avatar: '' },
        { id: '10', name: 'Morgan', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      gradient: WORKSPACE_GRADIENTS[3],
      path: '/workspace/support',
    },
    {
      id: '5',
      title: 'Team Meetings',
      emoji: '👥',
      memberCount: 25,
      callCount: 89,
      members: [
        { id: '11', name: 'Casey', avatar: '' },
        { id: '12', name: 'Riley', avatar: '' },
        { id: '13', name: 'Drew', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      gradient: WORKSPACE_GRADIENTS[4],
      path: '/workspace/team',
    },
    {
      id: '6',
      title: 'Client Onboarding',
      emoji: '🚀',
      memberCount: 10,
      callCount: 34,
      members: [
        { id: '14', name: 'Jamie', avatar: '' },
        { id: '15', name: 'Avery', avatar: '' },
      ],
      lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      gradient: WORKSPACE_GRADIENTS[5],
      path: '/workspace/onboarding',
    },
  ];

  const handleCreateWorkspace = () => {
    // TODO: Implement workspace creation modal
    console.log('Create workspace');
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Workspaces
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Organize your calls and insights into collaborative spaces
              </p>
            </div>
            <Button
              onClick={handleCreateWorkspace}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <RiAddLine className="w-5 h-5 mr-2" />
              New Workspace
            </Button>
          </div>

          {/* Filters and View Controls */}
          <div className="flex items-center justify-between">
            {/* Filter Tabs */}
            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <TabsList>
                <TabsTrigger value="recent">Recent activity</TabsTrigger>
                <TabsTrigger value="favorites">Favorites</TabsTrigger>
                <TabsTrigger value="all">All workspaces</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View and Sort Controls */}
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Sort: {sortBy === 'updated' ? 'Last updated' : sortBy === 'name' ? 'Name' : 'Members'}
                    <RiArrowDownSLine className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('updated')}>
                    Last updated
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('name')}>
                    Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('members')}>
                    Members
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === 'grid' 
                      ? "bg-white dark:bg-gray-700 text-purple-600 shadow-sm" 
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  aria-label="Grid view"
                >
                  <RiGridLine className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === 'list' 
                      ? "bg-white dark:bg-gray-700 text-purple-600 shadow-sm" 
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  aria-label="List view"
                >
                  <RiListCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workspaces Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} {...workspace} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center justify-center text-2xl border border-gray-200 dark:border-gray-700">
                    {workspace.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {workspace.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {workspace.memberCount} members • {workspace.callCount} calls
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(workspace.path)}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {workspaces.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <RiAddLine className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No workspaces yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first workspace to start organizing your calls
            </p>
            <Button
              onClick={handleCreateWorkspace}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <RiAddLine className="w-5 h-5 mr-2" />
              Create Workspace
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
