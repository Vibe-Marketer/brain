import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  RiAddLine,
  RiPlayCircleLine,
  RiFileTextLine,
  RiTimeLine,
  RiEmotionHappyLine,
  RiEmotionNormalLine,
  RiEmotionUnhappyLine,
} from '@remixicon/react';

interface Call {
  id: string;
  title: string;
  date: string;
  duration: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  insights: number;
  processed: boolean;
}

const mockCalls: Call[] = [
  {
    id: '1',
    title: 'Discovery Call - Acme Corp',
    date: 'Dec 13, 2024',
    duration: '45:32',
    sentiment: 'positive',
    insights: 8,
    processed: true,
  },
  {
    id: '2',
    title: 'Follow-up - TechStart Inc',
    date: 'Dec 13, 2024',
    duration: '32:15',
    sentiment: 'neutral',
    insights: 5,
    processed: true,
  },
  {
    id: '3',
    title: 'Demo Call - GlobalSoft',
    date: 'Dec 12, 2024',
    duration: '58:47',
    sentiment: 'positive',
    insights: 12,
    processed: true,
  },
  {
    id: '4',
    title: 'Quarterly Review - Enterprise Co',
    date: 'Dec 12, 2024',
    duration: '1:15:22',
    sentiment: 'neutral',
    insights: 15,
    processed: true,
  },
  {
    id: '5',
    title: 'Product Feedback - StartupXYZ',
    date: 'Dec 11, 2024',
    duration: '28:45',
    sentiment: 'negative',
    insights: 6,
    processed: true,
  },
];

export function CallsPage() {
  const navigate = useNavigate();
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedCalls.size === mockCalls.length) {
      setSelectedCalls(new Set());
    } else {
      setSelectedCalls(new Set(mockCalls.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedCalls);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCalls(newSelected);
  };

  const getSentimentIcon = (sentiment: Call['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return <RiEmotionHappyLine className="w-4 h-4 text-green-600" />;
      case 'neutral':
        return <RiEmotionNormalLine className="w-4 h-4 text-gray-600" />;
      case 'negative':
        return <RiEmotionUnhappyLine className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calls</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All your call transcripts and recordings
            </p>
          </div>
          <Button variant="default" className="gap-2">
            <RiAddLine className="w-5 h-5" />
            Upload Call
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="w-12 px-8 py-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedCalls.size === mockCalls.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border"
                />
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b-[3px] border-b-vibe-orange">
                Title
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Date
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Duration
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sentiment
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Insights
              </th>
              <th className="px-8 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {mockCalls.map((call) => (
              <tr
                key={call.id}
                className="border-b border-border hover:bg-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/calls/${call.id}`)}
              >
                <td className="px-8 py-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedCalls.has(call.id)}
                    onChange={() => toggleSelect(call.id)}
                    className="w-4 h-4 rounded border-border"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <RiPlayCircleLine className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground">{call.title}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {call.date}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <RiTimeLine className="w-4 h-4" />
                    {call.duration}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {getSentimentIcon(call.sentiment)}
                    <span className="text-sm text-muted-foreground capitalize">
                      {call.sentiment}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8800]/10 text-vibe-orange rounded-lg text-sm font-medium">
                    <RiFileTextLine className="w-4 h-4" />
                    {call.insights}
                  </div>
                </td>
                <td className="px-8 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="hollow" size="sm">
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
