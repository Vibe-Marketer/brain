import { useState } from 'react';
import { RiFilterLine, RiSearchLine, RiArrowUpDownLine, RiCheckLine } from '@remixicon/react';

interface FilterToolPanelProps {
  data?: {
    context: 'calls' | 'insights' | 'workspaces';
  };
}

export function FilterToolPanel({ data }: FilterToolPanelProps) {
  const context = data?.context || 'calls';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('date-desc');

  const filterOptions = {
    calls: [
      { id: 'processed', label: 'AI Processed', count: 24 },
      { id: 'unprocessed', label: 'Not Processed', count: 8 },
      { id: 'positive', label: 'Positive Sentiment', count: 18 },
      { id: 'negative', label: 'Negative Sentiment', count: 3 },
      { id: 'has-actions', label: 'Has Action Items', count: 15 },
    ],
    insights: [
      { id: 'pain', label: 'Pain Points', count: 42 },
      { id: 'success', label: 'Success Stories', count: 28 },
      { id: 'objection', label: 'Objections', count: 19 },
      { id: 'question', label: 'Questions', count: 35 },
      { id: 'high-confidence', label: 'High Confidence (>80%)', count: 67 },
    ],
    workspaces: [
      { id: 'recent', label: 'Recently Updated', count: 12 },
      { id: 'favorites', label: 'Favorites', count: 5 },
      { id: 'shared', label: 'Shared with Me', count: 8 },
      { id: 'owned', label: 'Owned by Me', count: 15 },
    ],
  };

  const sortOptions = {
    calls: [
      { id: 'date-desc', label: 'Newest First' },
      { id: 'date-asc', label: 'Oldest First' },
      { id: 'name-asc', label: 'Name (A-Z)' },
      { id: 'sentiment', label: 'Sentiment' },
    ],
    insights: [
      { id: 'date-desc', label: 'Newest First' },
      { id: 'confidence-desc', label: 'Highest Confidence' },
      { id: 'type', label: 'Type' },
    ],
    workspaces: [
      { id: 'updated-desc', label: 'Recently Updated' },
      { id: 'name-asc', label: 'Name (A-Z)' },
      { id: 'calls-desc', label: 'Most Calls' },
    ],
  };

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
    setSearchQuery('');
  };

  const activeFilterCount = selectedFilters.length + (searchQuery ? 1 : 0);

  return (
    <div className="p-4 space-y-6">
      {/* Search */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Search
        </label>
        <div className="relative">
          <RiSearchLine size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${context}...`}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <RiArrowUpDownLine size={14} />
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
        >
          {sortOptions[context].map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <RiFilterLine size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </label>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-1">
          {filterOptions[context].map(filter => {
            const isSelected = selectedFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`
                  w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-left
                  ${isSelected 
                    ? 'bg-purple-50 border-2 border-purple-600' 
                    : 'bg-white border border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected 
                      ? 'bg-purple-600 border-purple-600' 
                      : 'border-gray-300'
                    }
                  `}>
                    {isSelected && <RiCheckLine size={12} className="text-white" />}
                  </div>
                  <span className={`text-sm ${isSelected ? 'text-purple-900 font-medium' : 'text-gray-700'}`}>
                    {filter.label}
                  </span>
                </div>
                <span className={`text-xs ${isSelected ? 'text-purple-600 font-semibold' : 'text-gray-500'}`}>
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range (for calls and insights) */}
      {(context === 'calls' || context === 'insights') && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Apply Button */}
      <div className="pt-4 border-t border-gray-200">
        <button className="w-full py-2.5 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
          Apply Filters
        </button>
      </div>
    </div>
  );
}
