/**
 * AIStatusWidget Component
 * 
 * Shows current AI processing status with:
 * - Progress indicator
 * - Current task description
 * - Completed tasks list
 * - Error handling
 */

import React from 'react';
import { 
  RiRobot2Line, 
  RiCheckLine, 
  RiLoader4Line, 
  RiAlertLine,
  RiCloseLine 
} from '@remixicon/react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface AITask {
  id: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export interface AIStatusWidgetProps {
  isProcessing: boolean;
  currentTask?: string;
  progress?: number;
  tasks?: AITask[];
  onDismiss?: () => void;
  className?: string;
}

export const AIStatusWidget: React.FC<AIStatusWidgetProps> = ({
  isProcessing,
  currentTask,
  progress = 0,
  tasks = [],
  onDismiss,
  className,
}) => {
  if (!isProcessing && tasks.length === 0) {
    return null;
  }

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const errorTasks = tasks.filter(t => t.status === 'error');
  const processingTasks = tasks.filter(t => t.status === 'processing');

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-4",
        "max-w-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            isProcessing ? "bg-purple-100 dark:bg-purple-900/20" : "bg-green-100 dark:bg-green-900/20"
          )}>
            {isProcessing ? (
              <RiLoader4Line className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
            ) : (
              <RiRobot2Line className="w-5 h-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isProcessing ? 'AI Agent Working...' : 'AI Processing Complete'}
            </h4>
            {currentTask && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentTask}
              </p>
            )}
          </div>
        </div>
        {onDismiss && !isProcessing && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            aria-label="Dismiss"
          >
            <RiCloseLine className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {isProcessing && progress > 0 && (
        <div className="mb-3">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          {/* Processing Tasks */}
          {processingTasks.map(task => (
            <div
              key={task.id}
              className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/10 rounded-lg"
            >
              <RiLoader4Line className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">
                  {task.description}
                </p>
                {task.progress !== undefined && (
                  <Progress value={task.progress} className="h-1 mt-1" />
                )}
              </div>
            </div>
          ))}

          {/* Completed Tasks */}
          {completedTasks.map(task => (
            <div
              key={task.id}
              className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg"
            >
              <RiCheckLine className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                {task.description}
              </p>
            </div>
          ))}

          {/* Error Tasks */}
          {errorTasks.map(task => (
            <div
              key={task.id}
              className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg"
            >
              <RiAlertLine className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">
                  {task.description}
                </p>
                {task.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {task.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!isProcessing && tasks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Completed: {completedTasks.length}/{tasks.length}
            </span>
            {errorTasks.length > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {errorTasks.length} {errorTasks.length === 1 ? 'error' : 'errors'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact version for use in top bar
 */
export const AIStatusIndicator: React.FC<{
  isProcessing: boolean;
  onClick?: () => void;
}> = ({ isProcessing, onClick }) => {
  if (!isProcessing) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/20 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors"
    >
      <RiLoader4Line className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" />
      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
        AI Processing...
      </span>
    </button>
  );
};
