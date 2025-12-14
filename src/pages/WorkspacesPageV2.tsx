import { useState } from 'react';
import { RiAddLine, RiGridLine, RiListCheck } from '@remixicon/react';
import { usePanelStore } from '@/stores/panelStore';

const mockWorkspaces = [
  { id: '1', name: 'Product Discovery', emoji: '🚀', gradient: 'from-purple-400 to-pink-400', members: 5, calls: 12, updated: '2 hours ago' },
  { id: '2', name: 'Customer Success', emoji: '💡', gradient: 'from-blue-400 to-cyan-400', members: 8, calls: 24, updated: '5 hours ago' },
  { id: '3', name: 'Sales Calls', emoji: '📞', gradient: 'from-green-400 to-emerald-400', members: 3, calls: 18, updated: '1 day ago' },
  { id: '4', name: 'User Research', emoji: '🔍', gradient: 'from-orange-400 to-red-400', members: 4, calls: 9, updated: '2 days ago' },
  { id: '5', name: 'Onboarding', emoji: '🎯', gradient: 'from-indigo-400 to-purple-400', members: 6, calls: 15, updated: '3 days ago' },
  { id: '6', name: 'Support Escalations', emoji: '🆘', gradient: 'from-red-400 to-pink-400', members: 7, calls: 31, updated: '1 week ago' },
];

export function WorkspacesPageV2() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'recent' | 'favorites'>('all');
  const { openPanel } = usePanelStore();

  const handleWorkspaceClick = (workspace: typeof mockWorkspaces[0]) => {
    openPanel('workspace-detail', workspace);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
            <p className="text-sm text-gray-600 mt-1">Organize your calls into collaborative spaces</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
            <RiAddLine size={20} />
            New Workspace
          </button>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'recent', 'favorites'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${filter === f
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`
                p-2 rounded transition-colors
                ${viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <RiGridLine size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                p-2 rounded transition-colors
                ${viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <RiListCheck size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace)}
                className="group relative bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200 overflow-hidden text-left"
              >
                {/* Gradient Header */}
                <div className={`h-24 bg-gradient-to-br ${workspace.gradient} relative`}>
                  <div className="absolute -bottom-6 left-6">
                    <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center text-3xl border-4 border-white">
                      {workspace.emoji}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="pt-10 px-6 pb-6">
                  <h3 className="font-semibold text-gray-900 text-lg mb-2 group-hover:text-purple-600 transition-colors">
                    {workspace.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{workspace.members} members</span>
                    <span>•</span>
                    <span>{workspace.calls} calls</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Updated {workspace.updated}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {mockWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-white rounded-lg shadow flex items-center justify-center text-2xl border border-gray-100">
                  {workspace.emoji}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{workspace.name}</h3>
                  <p className="text-sm text-gray-600">{workspace.members} members • {workspace.calls} calls</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500">Updated {workspace.updated}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
