import { useState } from 'react';
import { RiFilterLine, RiSparklingLine, RiPercentLine } from '@remixicon/react';
import { usePanelStore } from '@/stores/panelStore';

const mockInsights = [
  { id: '1', type: 'Pain', content: 'Manual data entry taking 10+ hours per week', confidence: 92, source: 'Discovery Call - Acme Corp', tags: ['automation', 'efficiency'] },
  { id: '2', type: 'Success', content: 'Previous tool saved 20 hours per week', confidence: 88, source: 'Discovery Call - Acme Corp', tags: ['roi', 'productivity'] },
  { id: '3', type: 'Objection', content: 'Concerned about implementation timeline', confidence: 85, source: 'Discovery Call - Acme Corp', tags: ['timeline', 'implementation'] },
  { id: '4', type: 'Question', content: 'Can it integrate with Salesforce?', confidence: 95, source: 'Follow-up - TechStart Inc', tags: ['integration', 'salesforce'] },
  { id: '5', type: 'Pain', content: 'Data scattered across multiple tools', confidence: 90, source: 'Demo Call - GlobalSoft', tags: ['data-silos', 'integration'] },
  { id: '6', type: 'Result', content: 'Looking to reduce reporting time by 50%', confidence: 87, source: 'Demo Call - GlobalSoft', tags: ['reporting', 'efficiency'] },
  { id: '7', type: 'Success', content: 'Team loves collaborative features', confidence: 93, source: 'Check-in - Enterprise Co', tags: ['collaboration', 'ux'] },
  { id: '8', type: 'Objection', content: 'Budget concerns for Q1', confidence: 78, source: 'Sales Call - InnovateLabs', tags: ['budget', 'pricing'] },
];

export function InsightsPageV2() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const { openPanel } = usePanelStore();

  const handleInsightClick = (insight: typeof mockInsights[0]) => {
    openPanel('insight-detail', insight);
  };

  const handleFilterClick = () => {
    openPanel('filter-tool', { context: 'insights' });
  };

  const typeColors: Record<string, string> = {
    Pain: 'bg-red-100 text-red-700 border-red-200',
    Success: 'bg-green-100 text-green-700 border-green-200',
    Objection: 'bg-orange-100 text-orange-700 border-orange-200',
    Question: 'bg-blue-100 text-blue-700 border-blue-200',
    Result: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const filteredInsights = selectedType
    ? mockInsights.filter(i => i.type === selectedType)
    : mockInsights;

  const insightCounts = mockInsights.reduce((acc, insight) => {
    acc[insight.type] = (acc[insight.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
            <p className="text-sm text-gray-600 mt-1">Knowledge extracted from your calls</p>
          </div>
          <button 
            onClick={handleFilterClick}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <RiFilterLine size={20} />
            Filters
          </button>
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedType(null)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${selectedType === null
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            All ({mockInsights.length})
          </button>
          {Object.entries(insightCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                ${selectedType === type
                  ? typeColors[type]
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }
              `}
            >
              {type} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInsights.map((insight) => (
            <button
              key={insight.id}
              onClick={() => handleInsightClick(insight)}
              className="group text-left p-5 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${typeColors[insight.type]}`}>
                  <RiSparklingLine size={14} />
                  {insight.type}
                </span>
                <div className="flex items-center gap-1.5 text-sm">
                  <RiPercentLine size={14} className="text-gray-500" />
                  <span className="font-semibold text-gray-900">{insight.confidence}%</span>
                </div>
              </div>

              {/* Content */}
              <p className="text-gray-900 font-medium leading-relaxed mb-3 group-hover:text-purple-600 transition-colors">
                {insight.content}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-600 truncate flex-1">{insight.source}</p>
                <div className="flex gap-1.5 ml-2">
                  {insight.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
