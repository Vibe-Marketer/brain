/**
 * InsightsPage
 * 
 * AI Insights Dashboard showing all extracted insights
 * with filtering, search, and actions
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RiFilterLine, 
  RiSearchLine,
  RiDownloadLine,
  RiSparklingLine
} from '@remixicon/react';
import { InsightCard, type InsightType } from '@/components/loop/InsightCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'pain' | 'success' | 'objection' | 'question';

export const InsightsPage: React.FC = () => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('date');

  // Fetch insights from Supabase
  const { data: insights, isLoading } = useQuery({
    queryKey: ['insights', filterType, confidenceThreshold, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('insights')
        .select(`
          *,
          calls:call_id (
            id,
            title,
            created_at
          )
        `)
        .gte('confidence', confidenceThreshold);

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (sortBy === 'confidence') {
        query = query.order('confidence', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });

  // Filter insights by search query
  const filteredInsights = insights?.filter(insight =>
    insight.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    insight.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const handleUseInsight = (insightId: string) => {
    // TODO: Implement insight usage (generate content, add to playbook, etc.)
    console.log('Use insight:', insightId);
  };

  const handleViewContext = (callId: string) => {
    // TODO: Navigate to call detail
    console.log('View context:', callId);
  };

  const handleExportInsights = () => {
    // TODO: Implement export functionality
    console.log('Export insights');
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
                <RiSparklingLine className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  AI Insights
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {filteredInsights.length} insights extracted from your calls
                </p>
              </div>
            </div>
            <Button
              onClick={handleExportInsights}
              variant="outline"
            >
              <RiDownloadLine className="w-5 h-5 mr-2" />
              Export
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="space-y-4">
            {/* Type Filter Tabs */}
            <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <TabsList>
                <TabsTrigger value="all">
                  All Insights
                </TabsTrigger>
                <TabsTrigger value="pain">
                  Pain Points
                </TabsTrigger>
                <TabsTrigger value="success">
                  Success Stories
                </TabsTrigger>
                <TabsTrigger value="objection">
                  Objections
                </TabsTrigger>
                <TabsTrigger value="question">
                  Questions
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and Additional Filters */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search insights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Confidence Filter */}
              <Select
                value={confidenceThreshold.toString()}
                onValueChange={(v) => setConfidenceThreshold(parseInt(v))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Confidence</SelectItem>
                  <SelectItem value="50">50%+ Confidence</SelectItem>
                  <SelectItem value="70">70%+ Confidence</SelectItem>
                  <SelectItem value="85">85%+ Confidence</SelectItem>
                  <SelectItem value="95">95%+ Confidence</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as 'date' | 'confidence')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Most Recent</SelectItem>
                  <SelectItem value="confidence">Highest Confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Insights Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-800 animate-pulse"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded mb-3"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredInsights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInsights.map((insight: any) => (
              <InsightCard
                key={insight.id}
                id={insight.id}
                type={insight.type as InsightType}
                content={insight.content}
                source={{
                  callId: insight.calls.id,
                  callTitle: insight.calls.title,
                  date: new Date(insight.calls.created_at),
                }}
                confidence={insight.confidence}
                tags={insight.tags || []}
                onUse={() => handleUseInsight(insight.id)}
                onViewContext={() => handleViewContext(insight.calls.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <RiSparklingLine className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No insights found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Upload calls to start extracting insights'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
