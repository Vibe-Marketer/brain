import { RiTimeLine, RiEmotionLine, RiCheckboxCircleLine, RiSparklingLine } from '@remixicon/react';

interface CallDetailPanelProps {
  data?: {
    id: string;
    title: string;
    date: string;
    duration: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    insightCount: number;
    actionItemCount: number;
  };
}

export function CallDetailPanel({ data }: CallDetailPanelProps) {
  const call = data || {
    id: '1',
    title: 'Discovery Call - Acme Corp',
    date: 'Dec 13, 2024',
    duration: '45 min',
    sentiment: 'positive' as const,
    insightCount: 8,
    actionItemCount: 3
  };

  const sentimentColors = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-700',
    negative: 'bg-red-100 text-red-700'
  };

  return (
    <div className="p-4 space-y-6">
      {/* Call Header */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 leading-tight">{call.title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <RiTimeLine size={16} />
          <span>{call.date}</span>
          <span>•</span>
          <span>{call.duration}</span>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sentimentColors[call.sentiment]}`}>
          <RiEmotionLine size={14} />
          <span className="capitalize">{call.sentiment}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <RiSparklingLine size={16} />
            <span className="text-xs">Insights</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{call.insightCount}</div>
        </div>
        
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <RiCheckboxCircleLine size={16} />
            <span className="text-xs">Actions</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{call.actionItemCount}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Summary</h4>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-sm text-gray-700 leading-relaxed">
            Customer expressed strong interest in our analytics platform. Main pain points include data silos and lack of real-time insights. Budget approved for Q1 implementation.
          </p>
        </div>
      </div>

      {/* Key Insights */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Key Insights</h4>
        <div className="space-y-2">
          {[
            { type: 'Pain', text: 'Struggling with disconnected data sources', color: 'red' },
            { type: 'Success', text: 'Previous analytics tool saved 20 hours/week', color: 'green' },
            { type: 'Objection', text: 'Concerned about implementation timeline', color: 'orange' },
          ].map((insight, idx) => (
            <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors cursor-pointer">
              <div className="flex items-start gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-${insight.color}-100 text-${insight.color}-700`}>
                  {insight.type}
                </span>
                <p className="text-sm text-gray-700 flex-1">{insight.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
          View all insights →
        </button>
      </div>

      {/* Action Items */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Action Items</h4>
        <div className="space-y-2">
          {[
            'Send pricing proposal by Friday',
            'Schedule technical demo for next week',
            'Share case study from similar industry'
          ].map((action, idx) => (
            <label key={idx} className="flex items-start gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer">
              <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <span className="text-sm text-gray-700">{action}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-200 space-y-2">
        <button className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
          Generate Content
        </button>
        <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
          View Full Transcript
        </button>
      </div>
    </div>
  );
}
