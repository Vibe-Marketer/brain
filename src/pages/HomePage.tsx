import { useNavigate } from 'react-router-dom';
import { RiFolderLine, RiPhoneLine, RiLightbulbLine, RiBarChartLine } from '@remixicon/react';

export function HomePage() {
  const navigate = useNavigate();

  const quickActions = [
    { icon: RiFolderLine, label: 'Workspaces', description: 'Organize your calls', path: '/workspaces', color: 'purple' },
    { icon: RiPhoneLine, label: 'Calls', description: 'View all transcripts', path: '/calls', color: 'blue' },
    { icon: RiLightbulbLine, label: 'Insights', description: 'AI-extracted knowledge', path: '/insights', color: 'green' },
    { icon: RiBarChartLine, label: 'Analytics', description: 'Data and metrics', path: '/analytics', color: 'orange' },
  ];

  const colorClasses = {
    purple: 'from-purple-400 to-purple-600',
    blue: 'from-blue-400 to-blue-600',
    green: 'from-green-400 to-green-600',
    orange: 'from-orange-400 to-orange-600',
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to CallVault
          </h1>
          <p className="text-lg text-gray-600">
            Your AI-powered conversation intelligence platform
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 text-left overflow-hidden"
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[action.color as keyof typeof colorClasses]} opacity-0 group-hover:opacity-10 transition-opacity`} />
                
                {/* Content */}
                <div className="relative">
                  <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${colorClasses[action.color as keyof typeof colorClasses]} mb-4`}>
                    <Icon size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {action.label}
                  </h3>
                  <p className="text-gray-600">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Stats</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">24</div>
              <div className="text-sm text-gray-600">Total Calls</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">156</div>
              <div className="text-sm text-gray-600">Insights</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">6</div>
              <div className="text-sm text-gray-600">Workspaces</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
