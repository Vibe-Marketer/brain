import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RiAddLine, RiTeamLine, RiPhoneLine } from '@remixicon/react';

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  members: number;
  calls: number;
  updatedAt: string;
}

const workspaces: Workspace[] = [
  {
    id: '1',
    name: 'Product Discovery',
    emoji: '🚀',
    gradient: 'from-purple-400 to-pink-400',
    members: 5,
    calls: 12,
    updatedAt: '2 hours ago',
  },
  {
    id: '2',
    name: 'Customer Success',
    emoji: '💡',
    gradient: 'from-blue-400 to-cyan-400',
    members: 8,
    calls: 24,
    updatedAt: '5 hours ago',
  },
  {
    id: '3',
    name: 'Sales Calls',
    emoji: '📞',
    gradient: 'from-green-400 to-emerald-400',
    members: 3,
    calls: 18,
    updatedAt: '1 day ago',
  },
  {
    id: '4',
    name: 'Engineering Sync',
    emoji: '⚙️',
    gradient: 'from-orange-400 to-red-400',
    members: 12,
    calls: 36,
    updatedAt: '3 hours ago',
  },
  {
    id: '5',
    name: 'Marketing Strategy',
    emoji: '📊',
    gradient: 'from-indigo-400 to-purple-400',
    members: 6,
    calls: 15,
    updatedAt: '1 hour ago',
  },
  {
    id: '6',
    name: 'User Research',
    emoji: '🔍',
    gradient: 'from-teal-400 to-green-400',
    members: 4,
    calls: 9,
    updatedAt: '6 hours ago',
  },
];

export function WorkspacesPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize your calls into collaborative spaces
            </p>
          </div>
          <Button variant="default" className="gap-2">
            <RiAddLine className="w-5 h-5" />
            New Workspace
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
          {workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/workspaces/${workspace.id}`)}
      className="group bg-viewport rounded-xl border border-border hover:border-muted-foreground hover:shadow-lg transition-all overflow-hidden cursor-pointer"
    >
      {/* Gradient Header */}
      <div className={`h-24 bg-gradient-to-br ${workspace.gradient} relative`}>
        <div className="absolute -bottom-6 left-6">
          <div className="w-16 h-16 bg-card rounded-xl shadow-lg flex items-center justify-center text-3xl border-4 border-card">
            {workspace.emoji}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 px-6 pb-6">
        <h3 className="font-semibold text-foreground text-lg mb-2 group-hover:text-vibe-orange transition-colors">
          {workspace.name}
        </h3>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <RiTeamLine className="w-4 h-4" />
            <span>{workspace.members} members</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <RiPhoneLine className="w-4 h-4" />
            <span>{workspace.calls} calls</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Updated {workspace.updatedAt}
        </div>
      </div>
    </div>
  );
}
