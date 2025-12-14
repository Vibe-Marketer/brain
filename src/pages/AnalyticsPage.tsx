/**
 * AnalyticsPage
 * 
 * Analytics dashboard with:
 * - Call volume trends
 * - Sentiment analysis
 * - Topic distribution
 * - Insight categories
 * - Performance metrics
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RiBarChartLine,
  RiPieChartLine,
  RiLineChartLine,
  RiArrowUpLine,
  RiEmotionHappyLine,
  RiEmotionNormalLine,
  RiEmotionUnhappyLine,
} from '@remixicon/react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-lg", color)}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            change >= 0 ? "text-green-600" : "text-red-600"
          )}>
            <RiArrowUpLine className={cn("w-4 h-4", change < 0 && "rotate-180")} />
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {title}
      </p>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  // Fetch calls
  const { data: calls } = useQuery({
    queryKey: ['analytics-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch insights
  const { data: insights } = useQuery({
    queryKey: ['analytics-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insights')
        .select('*');

      if (error) throw error;
      return data;
    },
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!calls || !insights) return null;

    const totalCalls = calls.length;
    const processedCalls = calls.filter(c => c.ai_processed).length;
    const totalInsights = insights.length;

    // Sentiment distribution
    const sentimentCounts = {
      positive: calls.filter(c => c.sentiment === 'positive').length,
      neutral: calls.filter(c => c.sentiment === 'neutral').length,
      negative: calls.filter(c => c.sentiment === 'negative').length,
    };

    // Insight type distribution
    const insightTypes = {
      pain: insights.filter(i => i.type === 'pain').length,
      success: insights.filter(i => i.type === 'success').length,
      objection: insights.filter(i => i.type === 'objection').length,
      question: insights.filter(i => i.type === 'question').length,
    };

    // Average confidence
    const avgConfidence = insights.length > 0
      ? insights.reduce((sum, i) => sum + (i.confidence || 0), 0) / insights.length
      : 0;

    // Calls per month (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const recentCalls = calls.filter(c => new Date(c.created_at) >= sixMonthsAgo);

    const callsByMonth = recentCalls.reduce((acc, call) => {
      const month = new Date(call.created_at).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top topics
    const topicCounts: Record<string, number> = {};
    calls.forEach(call => {
      if (call.key_topics) {
        call.key_topics.forEach((topic: string) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    return {
      totalCalls,
      processedCalls,
      totalInsights,
      sentimentCounts,
      insightTypes,
      avgConfidence,
      callsByMonth,
      topTopics,
    };
  }, [calls, insights]);

  if (!analytics) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Insights and trends from your calls
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Calls"
            value={analytics.totalCalls}
            change={12}
            icon={RiBarChartLine}
            color="bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          />
          <StatCard
            title="AI Processed"
            value={analytics.processedCalls}
            change={8}
            icon={RiLineChartLine}
            color="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Total Insights"
            value={analytics.totalInsights}
            change={15}
            icon={RiPieChartLine}
            color="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Avg Confidence"
            value={`${Math.round(analytics.avgConfidence)}%`}
            icon={RiArrowUpLine}
            color="bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Distribution */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Sentiment Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RiEmotionHappyLine className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Positive
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {analytics.sentimentCounts.positive}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{
                      width: `${(analytics.sentimentCounts.positive / analytics.totalCalls) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RiEmotionNormalLine className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Neutral
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {analytics.sentimentCounts.neutral}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-600 rounded-full"
                    style={{
                      width: `${(analytics.sentimentCounts.neutral / analytics.totalCalls) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RiEmotionUnhappyLine className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Negative
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {analytics.sentimentCounts.negative}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{
                      width: `${(analytics.sentimentCounts.negative / analytics.totalCalls) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Insight Types */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Insight Categories
            </h3>
            <div className="space-y-4">
              {Object.entries(analytics.insightTypes).map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {type}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        type === 'pain' && "bg-red-600",
                        type === 'success' && "bg-green-600",
                        type === 'objection' && "bg-orange-600",
                        type === 'question' && "bg-blue-600"
                      )}
                      style={{
                        width: `${(count / analytics.totalInsights) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Topics */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Top Topics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {analytics.topTopics.map(([topic, count]) => (
                <div
                  key={topic}
                  className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800"
                >
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {count}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {topic}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
