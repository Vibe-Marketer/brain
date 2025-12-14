/**
 * InsightCard Component
 * 
 * Displays AI-extracted insights with:
 * - Type indicator (Pain, Success, Objection, Question)
 * - Content preview
 * - Source information
 * - Confidence score
 * - Action buttons
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  RiEmotionUnhappyLine, 
  RiTrophyLine, 
  RiAlertLine, 
  RiQuestionLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiSparklingLine
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type InsightType = 'pain' | 'success' | 'objection' | 'question';

export interface InsightCardProps {
  id: string;
  type: InsightType;
  content: string;
  source: {
    callId: string;
    callTitle: string;
    date: Date;
  };
  confidence: number;
  tags?: string[];
  onUse?: () => void;
  onViewContext?: () => void;
}

const INSIGHT_CONFIG = {
  pain: {
    icon: RiEmotionUnhappyLine,
    label: 'Pain Point',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  success: {
    icon: RiTrophyLine,
    label: 'Success Story',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  objection: {
    icon: RiAlertLine,
    label: 'Objection',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  question: {
    icon: RiQuestionLine,
    label: 'Question',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  id,
  type,
  content,
  source,
  confidence,
  tags = [],
  onUse,
  onViewContext,
}) => {
  const config = INSIGHT_CONFIG[type];
  const Icon = config.icon;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 rounded-xl p-5 border-2 transition-all",
        "hover:shadow-lg hover:-translate-y-0.5",
        config.borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <Icon className={cn("w-5 h-5", config.color)} />
          </div>
          <div>
            <h4 className={cn("text-sm font-semibold", config.color)}>
              {config.label}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <RiSparklingLine className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {Math.round(confidence)}%
          </span>
        </div>
      </div>

      {/* Content */}
      <blockquote className="text-gray-900 dark:text-white mb-4 leading-relaxed">
        "{content}"
      </blockquote>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Confidence
          </span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {Math.round(confidence)}%
          </span>
        </div>
        <Progress value={confidence} className="h-1" />
      </div>

      {/* Source */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              From:
            </p>
            <Link
              to={`/call/${source.callId}`}
              className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline truncate block"
            >
              {source.callTitle}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(source.date)}
            </p>
          </div>
          <button
            onClick={onViewContext}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors ml-2"
            aria-label="View context"
          >
            <RiExternalLinkLine className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onViewContext}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <RiExternalLinkLine className="w-4 h-4 mr-2" />
          View Context
        </Button>
        <Button
          onClick={onUse}
          size="sm"
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
        >
          <RiFileCopyLine className="w-4 h-4 mr-2" />
          Use This
        </Button>
      </div>
    </div>
  );
};
