/**
 * Error Log Viewer (Admin Only)
 *
 * Floating panel that shows all captured errors in real-time.
 * Provides immediate visibility into errors for rapid debugging.
 *
 * Only visible to users with ADMIN role. Works in all environments
 * (dev and production) so admins can diagnose issues as they happen.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  type ErrorLogEntry,
  getErrorLog,
  getErrorStats,
  clearErrorLog,
} from '@/lib/error-capture';
import { useUserRole } from '@/hooks/useUserRole';
import { RiCloseLine, RiDeleteBinLine, RiArrowDownSLine, RiArrowUpSLine, RiBugLine } from '@remixicon/react';

// Admin-only error viewer for production debugging
// The floating button provides quick access to captured errors

// Source badges with colors
const sourceConfig: Record<string, { label: string; color: string }> = {
  'window.onerror': { label: 'Global', color: 'bg-red-500' },
  'unhandledrejection': { label: 'Promise', color: 'bg-purple-500' },
  'console.error': { label: 'Console', color: 'bg-yellow-500' },
  'network': { label: 'Network', color: 'bg-blue-500' },
  'react-boundary': { label: 'React', color: 'bg-pink-500' },
  'manual': { label: 'Logger', color: 'bg-green-500' },
  'unknown': { label: 'Unknown', color: 'bg-gray-500' },
};

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ErrorEntry({ entry, isExpanded, onToggle }: {
  entry: ErrorLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = sourceConfig[entry.source] || sourceConfig.unknown;

  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full text-left p-2 hover:bg-gray-800 transition-colors flex items-start gap-2"
      >
        <span className={`${config.color} text-white text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5`}>
          {config.label}
        </span>
        <span className="text-gray-400 text-xs shrink-0 mt-0.5 font-mono">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className="text-gray-200 text-xs flex-1 truncate">
          {entry.message}
        </span>
        {entry.sentToSentry && (
          <span className="text-green-400 text-[10px] shrink-0" title="Sent to Sentry">
            S
          </span>
        )}
        {isExpanded ? (
          <RiArrowUpSLine className="h-4 w-4 text-gray-500 shrink-0" />
        ) : (
          <RiArrowDownSLine className="h-4 w-4 text-gray-500 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 text-xs">
          <div className="bg-gray-900 rounded p-2 space-y-2 overflow-x-auto">
            <div>
              <span className="text-gray-500">Message: </span>
              <span className="text-red-300 font-mono break-all">{entry.message}</span>
            </div>

            {entry.stack && (
              <div>
                <span className="text-gray-500">Stack: </span>
                <pre className="text-gray-400 font-mono text-[10px] whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">
                  {entry.stack}
                </pre>
              </div>
            )}

            {entry.componentStack && (
              <div>
                <span className="text-gray-500">Component Stack: </span>
                <pre className="text-blue-300 font-mono text-[10px] whitespace-pre-wrap mt-1 max-h-24 overflow-y-auto">
                  {entry.componentStack}
                </pre>
              </div>
            )}

            {entry.url && (
              <div>
                <span className="text-gray-500">Location: </span>
                <span className="text-yellow-300 font-mono">
                  {entry.url}:{entry.lineNumber}:{entry.columnNumber}
                </span>
              </div>
            )}

            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div>
                <span className="text-gray-500">Metadata: </span>
                <pre className="text-green-300 font-mono text-[10px] whitespace-pre-wrap mt-1">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="text-gray-600 text-[10px]">
              ID: {entry.id} | Sentry: {entry.sentToSentry ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorLogViewer() {
  // Check admin status first (hook must be called unconditionally)
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [errors, setErrors] = useState<readonly ErrorLogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newErrorCount, setNewErrorCount] = useState(0);

  // Update errors on mount and when new errors occur
  const refreshErrors = useCallback(() => {
    setErrors(getErrorLog());
  }, []);

  useEffect(() => {
    // Only set up listeners for admin users
    if (!isAdmin) return;

    refreshErrors();

    // Listen for new errors
    const handleNewError = (_event: CustomEvent<ErrorLogEntry>) => {
      refreshErrors();
      if (!isOpen || isMinimized) {
        setNewErrorCount(prev => prev + 1);
      }
    };

    const handleClear = () => {
      refreshErrors();
      setNewErrorCount(0);
    };

    window.addEventListener('error-log-update', handleNewError as EventListener);
    window.addEventListener('error-log-cleared', handleClear);

    return () => {
      window.removeEventListener('error-log-update', handleNewError as EventListener);
      window.removeEventListener('error-log-cleared', handleClear);
    };
  }, [refreshErrors, isOpen, isMinimized, isAdmin]);

  // Reset new error count when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setNewErrorCount(0);
    }
  }, [isOpen, isMinimized]);

  // Only render for admin users (after all hooks)
  if (roleLoading || !isAdmin) return null;

  const stats = getErrorStats();
  const recentErrors = [...errors].reverse(); // Show newest first

  // Floating button (always visible)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all group"
        title="Open Error Log"
      >
        <RiBugLine className="h-5 w-5" />
        {newErrorCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {newErrorCount > 99 ? '99+' : newErrorCount}
          </span>
        )}
        {errors.length > 0 && newErrorCount === 0 && (
          <span className="absolute -top-1 -right-1 bg-gray-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {errors.length > 99 ? '99+' : errors.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl transition-all ${
        isMinimized
          ? 'bottom-4 right-4 w-auto'
          : 'bottom-4 right-4 w-[400px] max-h-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <RiBugLine className="h-4 w-4 text-red-400" />
          <span className="text-white text-sm font-medium">
            Error Log
          </span>
          <span className="text-gray-400 text-xs">
            ({stats.total} total, {stats.lastHour} last hour)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              clearErrorLog();
              refreshErrors();
            }}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Clear errors"
          >
            <RiDeleteBinLine className="h-4 w-4 text-gray-400" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <RiArrowUpSLine className="h-4 w-4 text-gray-400" />
            ) : (
              <RiArrowDownSLine className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <RiCloseLine className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content (only when not minimized) */}
      {!isMinimized && (
        <>
          {/* Stats bar */}
          <div className="px-3 py-1.5 border-b border-gray-700 flex flex-wrap gap-2 text-[10px]">
            {Object.entries(stats.bySource).map(([source, count]) => {
              if (count === 0) return null;
              const config = sourceConfig[source] || sourceConfig.unknown;
              return (
                <span key={source} className="flex items-center gap-1">
                  <span className={`${config.color} w-2 h-2 rounded-full`} />
                  <span className="text-gray-400">{config.label}:</span>
                  <span className="text-white">{count}</span>
                </span>
              );
            })}
          </div>

          {/* Error list */}
          <div className="max-h-[350px] overflow-y-auto">
            {recentErrors.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No errors captured yet
              </div>
            ) : (
              recentErrors.map(error => (
                <ErrorEntry
                  key={error.id}
                  entry={error}
                  isExpanded={expandedId === error.id}
                  onToggle={() => setExpandedId(
                    expandedId === error.id ? null : error.id
                  )}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
