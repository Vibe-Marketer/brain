import { RiUser3Line, RiPhoneLine, RiCalendarLine, RiMoreLine } from '@remixicon/react';

interface WorkspaceDetailPanelProps {
  data?: {
    id: string;
    name: string;
    emoji: string;
    memberCount: number;
    callCount: number;
    lastUpdated: string;
  };
}

export function WorkspaceDetailPanel({ data }: WorkspaceDetailPanelProps) {
  // Mock data if none provided
  const workspace = data || {
    id: '1',
    name: 'Product Discovery',
    emoji: '🚀',
    memberCount: 5,
    callCount: 12,
    lastUpdated: '2 hours ago'
  };

  return (
    <div className="p-4 space-y-6">
      {/* Workspace Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{workspace.emoji}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
            <p className="text-xs text-gray-500">Updated {workspace.lastUpdated}</p>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded">
            <RiMoreLine size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <RiUser3Line size={16} />
            <span className="text-xs">Members</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{workspace.memberCount}</div>
        </div>
        
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <RiPhoneLine size={16} />
            <span className="text-xs">Calls</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{workspace.callCount}</div>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Members</h4>
        <div className="space-y-2">
          {[
            { name: 'Sarah Johnson', role: 'Owner', avatar: 'SJ' },
            { name: 'Mike Chen', role: 'Editor', avatar: 'MC' },
            { name: 'Emma Davis', role: 'Editor', avatar: 'ED' },
            { name: 'Alex Kim', role: 'Viewer', avatar: 'AK' },
            { name: 'Lisa Wang', role: 'Viewer', avatar: 'LW' },
          ].map((member, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-medium">
                {member.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{member.name}</div>
                <div className="text-xs text-gray-500">{member.role}</div>
              </div>
            </div>
          ))}
        </div>
        
        <button className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
          + Add member
        </button>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Recent Activity</h4>
        <div className="space-y-3">
          {[
            { action: 'added a call', user: 'Sarah', time: '2h ago', icon: RiPhoneLine },
            { action: 'processed insights', user: 'AI', time: '3h ago', icon: RiCalendarLine },
            { action: 'added a call', user: 'Mike', time: '5h ago', icon: RiPhoneLine },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <activity.icon size={14} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                </p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-200 space-y-2">
        <button className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
          Open Workspace
        </button>
        <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
          Workspace Settings
        </button>
      </div>
    </div>
  );
}
