import { useState } from 'react';
import { RiAddLine, RiEmotionLine, RiSparklingLine, RiFilterLine } from '@remixicon/react';
import { usePanelStore } from '@/stores/panelStore';

const mockCalls = [
  { id: '1', title: 'Discovery Call - Acme Corp', date: 'Dec 13, 2024', duration: '45 min', sentiment: 'positive', insights: 8, processed: true },
  { id: '2', title: 'Follow-up - TechStart Inc', date: 'Dec 13, 2024', duration: '30 min', sentiment: 'neutral', insights: 5, processed: true },
  { id: '3', title: 'Demo Call - GlobalSoft', date: 'Dec 12, 2024', duration: '60 min', sentiment: 'positive', insights: 12, processed: true },
  { id: '4', title: 'Support Call - DataCo', date: 'Dec 12, 2024', duration: '25 min', sentiment: 'negative', insights: 6, processed: true },
  { id: '5', title: 'Sales Call - InnovateLabs', date: 'Dec 11, 2024', duration: '40 min', sentiment: 'positive', insights: 9, processed: true },
  { id: '6', title: 'Onboarding - NewClient LLC', date: 'Dec 11, 2024', duration: '50 min', sentiment: 'neutral', insights: 0, processed: false },
  { id: '7', title: 'Check-in - Enterprise Co', date: 'Dec 10, 2024', duration: '20 min', sentiment: 'positive', insights: 4, processed: true },
  { id: '8', title: 'Discovery - StartupXYZ', date: 'Dec 10, 2024', duration: '35 min', sentiment: 'neutral', insights: 0, processed: false },
];

export function CallsPageV2() {
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const { openPanel } = usePanelStore();

  const handleCallClick = (call: typeof mockCalls[0]) => {
    openPanel('call-detail', call);
  };

  const handleFilterClick = () => {
    openPanel('filter-tool', { context: 'calls' });
  };

  const toggleCallSelection = (callId: string) => {
    setSelectedCalls(prev =>
      prev.includes(callId)
        ? prev.filter(id => id !== callId)
        : [...prev, callId]
    );
  };

  const sentimentColors = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-700',
    negative: 'bg-red-100 text-red-700',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
            <p className="text-sm text-gray-600 mt-1">All your call transcripts and recordings</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleFilterClick}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              <RiFilterLine size={20} />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
              <RiAddLine size={20} />
              Upload Call
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Total:</span>
            <span className="font-semibold text-gray-900">{mockCalls.length}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Processed:</span>
            <span className="font-semibold text-gray-900">{mockCalls.filter(c => c.processed).length}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Pending:</span>
            <span className="font-semibold text-gray-900">{mockCalls.filter(c => !c.processed).length}</span>
          </div>
          {selectedCalls.length > 0 && (
            <div className="flex items-center gap-2 text-sm ml-auto">
              <span className="text-purple-600 font-semibold">{selectedCalls.length} selected</span>
              <button className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700">
                Process Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="space-y-2">
          {mockCalls.map((call) => (
            <div
              key={call.id}
              className="group flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedCalls.includes(call.id)}
                onChange={() => toggleCallSelection(call.id)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Call Info */}
              <button
                onClick={() => handleCallClick(call)}
                className="flex-1 flex items-center gap-4 text-left min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                    {call.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                    <span>{call.date}</span>
                    <span>•</span>
                    <span>{call.duration}</span>
                  </div>
                </div>

                {/* Sentiment */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sentimentColors[call.sentiment]}`}>
                  <RiEmotionLine size={14} />
                  <span className="capitalize">{call.sentiment}</span>
                </div>

                {/* Insights */}
                {call.processed ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                    <RiSparklingLine size={16} />
                    <span>{call.insights} insights</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
                    Not processed
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
