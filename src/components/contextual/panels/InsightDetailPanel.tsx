import { RiSparklingLine, RiPercentLine, RiPriceTag3Line, RiPhoneLine } from '@remixicon/react';

interface InsightDetailPanelProps {
  data?: {
    id: string;
    type: string;
    content: string;
    confidence: number;
    source: string;
    tags: string[];
  };
}

export function InsightDetailPanel({ data }: InsightDetailPanelProps) {
  const insight = data || {
    id: '1',
    type: 'Pain',
    content: 'Customer is frustrated with manual data entry taking 10+ hours per week',
    confidence: 92,
    source: 'Discovery Call - Acme Corp',
    tags: ['automation', 'efficiency', 'data-entry']
  };

  const typeColors: Record<string, string> = {
    Pain: 'bg-red-100 text-red-700',
    Success: 'bg-green-100 text-green-700',
    Objection: 'bg-orange-100 text-orange-700',
    Question: 'bg-blue-100 text-blue-700',
    Result: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-4 space-y-6">
      {/* Insight Header */}
      <div className="space-y-3">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${typeColors[insight.type] || 'bg-gray-100 text-gray-700'}`}>
          <RiSparklingLine size={16} />
          <span>{insight.type}</span>
        </div>
        
        <p className="text-base text-gray-900 leading-relaxed font-medium">
          {insight.content}
        </p>
      </div>

      {/* Confidence Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <RiPercentLine size={16} />
            <span>Confidence</span>
          </div>
          <span className="font-semibold text-gray-900">{insight.confidence}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
            style={{ width: `${insight.confidence}%` }}
          />
        </div>
      </div>

      {/* Source */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Source</h4>
        <div className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <RiPhoneLine size={16} className="text-gray-600" />
            <span className="text-sm text-gray-900 font-medium">{insight.source}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tags</h4>
        <div className="flex flex-wrap gap-2">
          {insight.tags.map((tag, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <RiPriceTag3Line size={12} />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Context */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Context</h4>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-sm text-gray-700 leading-relaxed italic">
            "We're spending way too much time on data entry. Our team is manually inputting information from calls, emails, and meetings. It's taking at least 10 hours per week, and we're still making mistakes. We need something that can automate this process."
          </p>
        </div>
      </div>

      {/* Related Insights */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Related Insights</h4>
        <div className="space-y-2">
          {[
            { type: 'Result', text: 'Looking to save 10+ hours per week' },
            { type: 'Objection', text: 'Worried about accuracy of automation' },
          ].map((related, idx) => (
            <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors cursor-pointer">
              <div className="flex items-start gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColors[related.type]}`}>
                  {related.type}
                </span>
                <p className="text-sm text-gray-700 flex-1">{related.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-200 space-y-2">
        <button className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
          Generate Content from This
        </button>
        <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
          View in Call
        </button>
      </div>
    </div>
  );
}
