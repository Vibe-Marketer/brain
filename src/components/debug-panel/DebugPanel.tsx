/**
 * Debug Panel (Admin Only)
 *
 * Comprehensive debugging console with List, Analytics, and Timeline views.
 * Provides real-time error visibility, performance metrics, and debug dump export.
 */

import { useState, useRef, useMemo, Component, useEffect } from 'react';
import {
  RiBugLine,
  RiCloseLine,
  RiDownloadLine,
  RiMailLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
  RiTimeLine,
  RiBookmarkLine,
  RiBookmarkFill,
  RiBarChartLine,
  RiListUnordered,
  RiDeleteBinLine,
  RiSearchLine,
  RiFileCopyLine,
  RiCheckLine,
  RiCheckDoubleLine,
  RiArrowGoBackLine,
  RiEyeOffLine,
  RiEyeLine,
  RiGlobeLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { captureDebugScreenshot } from '@/lib/screenshot';
import { useUserRole } from '@/hooks/useUserRole';
import { useDebugPanel, setGlobalDebugLogger } from './DebugPanelContext';
import type { DebugMessage, DebugDump, EnhancedDebugDump, MessageFilter, CategoryFilter, ViewMode } from './types';
import { generateSummary, parseUserAgent, formatAsMarkdown } from './debug-dump-utils';
import WebhookDeliveryViewerV2 from './WebhookDeliveryViewerV2';

// Error Boundary to prevent debug panel crashes from affecting main app
class DebugPanelErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log but don't feed back into the debug panel to prevent loops
    const originalError = (console as unknown as { _originalError?: typeof console.error })._originalError || console.error;
    originalError('Debug Panel Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-6 right-6 z-[9999] p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg max-w-sm dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
            <RiBugLine className="w-4 h-4" />
            <span className="font-medium">Debug Panel Error</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            The debug panel encountered an error but your app is still working.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper function outside component to avoid recreation
function categorizeMessage(msg: DebugMessage): DebugMessage['category'] {
  if (msg.category) return msg.category;
  const source = (msg.source || '').toLowerCase();
  const message = (msg.message || '').toLowerCase();

  if (source.includes('api') || message.includes('fetch') || message.includes('api')) return 'api';
  if (source.includes('auth') || message.includes('auth') || message.includes('login')) return 'auth';
  if (source.includes('sync') || message.includes('sync')) return 'sync';
  if (source.includes('network') || message.includes('network')) return 'network';
  return 'system';
}

function DebugPanelCore() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const {
    messages,
    actionTrail,
    unacknowledgedCount,
    resolvedErrors,
    ignoredPatterns,
    clearMessages,
    toggleBookmark,
    acknowledgeErrors,
    addMessage,
    logAction,
    logWebSocket,
    resolveError,
    unresolveError,
    ignoreMessage,
    addIgnorePattern,
    unignorePattern,
    isMessageIgnored,
  } = useDebugPanel();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [_categoryFilter, _setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingDump, setIsGeneratingDump] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Register global logger with all functions
  useEffect(() => {
    setGlobalDebugLogger(addMessage, logAction, logWebSocket);
  }, [addMessage, logAction, logWebSocket]);

  // Acknowledge errors when panel is opened
  useEffect(() => {
    if (isOpen && unacknowledgedCount > 0) {
      acknowledgeErrors();
    }
  }, [isOpen, unacknowledgedCount, acknowledgeErrors]);

  // Compute counts early (needed for analytics)
  const errorCount = messages.filter(m => m.type === 'error').length;
  const warningCount = messages.filter(m => m.type === 'warning').length;
  const bookmarkedCount = messages.filter(m => m.isBookmarked).length;
  const resolvedCount = messages.filter(m => m.resolutionStatus === 'resolved').length;
  const recurringCount = messages.filter(m => m.resolutionStatus === 'recurring').length;
  const resolvedErrorsCount = resolvedErrors.size;
  const ignoredCount = ignoredPatterns.size;

  // Analytics data - must be called unconditionally (before early return)
  const analyticsData = useMemo(() => {
    if (!isOpen || viewMode !== 'analytics') return null;

    const errors = messages.filter(m => m.type === 'error');
    const warnings = messages.filter(m => m.type === 'warning');

    // Calculate intervals between messages
    const intervals: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      intervals.push(messages[i].timestamp - messages[i - 1].timestamp);
    }

    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const median = sortedIntervals.length > 0
      ? sortedIntervals.length % 2 === 0
        ? (sortedIntervals[sortedIntervals.length / 2 - 1] + sortedIntervals[sortedIntervals.length / 2]) / 2
        : sortedIntervals[Math.floor(sortedIntervals.length / 2)]
      : 0;

    const p99Index = Math.ceil(sortedIntervals.length * 0.99) - 1;
    const p99 = sortedIntervals.length > 0 ? sortedIntervals[Math.max(0, p99Index)] : 0;
    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

    const formatTime = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;

    // Group by category
    const byCategory = messages.reduce((acc, msg) => {
      const cat = categorizeMessage(msg);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMessages: messages.length,
      errorRate: messages.length > 0 ? (errors.length / messages.length * 100).toFixed(1) : '0',
      warningRate: messages.length > 0 ? (warnings.length / messages.length * 100).toFixed(1) : '0',
      intervals: {
        avg: formatTime(avgInterval),
        median: formatTime(median),
        p99: formatTime(p99),
      },
      byCategory,
      bookmarked: bookmarkedCount,
    };
  }, [messages, isOpen, viewMode, bookmarkedCount]);

  // Timeline data - must be called unconditionally (before early return)
  const timelineData = useMemo(() => {
    if (!isOpen || viewMode !== 'timeline') return null;
    return messages.map((msg, index) => ({
      ...msg,
      relativeTime: index > 0 ? msg.timestamp - messages[0].timestamp : 0,
      category: categorizeMessage(msg),
    }));
  }, [messages, isOpen, viewMode]);

  // Don't render for non-admins (after all hooks are called)
  if (roleLoading || !isAdmin) return null;

  const filteredMessages = messages.filter(msg => {
    // Filter out ignored messages unless showIgnored is enabled
    if (!showIgnored && isMessageIgnored(msg)) return false;
    if (filter !== 'all' && msg.type !== filter) return false;
    if (_categoryFilter !== 'all') {
      const category = categorizeMessage(msg);
      if (category !== _categoryFilter) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        msg.message.toLowerCase().includes(query) ||
        msg.source?.toLowerCase().includes(query) ||
        msg.details?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const toggleExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const generateDebugDump = async (): Promise<EnhancedDebugDump> => {
    let screenshot: string | undefined;
    try {
      const result = await captureDebugScreenshot();
      screenshot = result.dataUrl;
    } catch {
      // Screenshot failed, continue without it
    }

    const appState = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };

    const { browser, os } = parseUserAgent(navigator.userAgent);

    return {
      timestamp: Date.now(),
      sessionId: `debug-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      messages: messages.map(msg => ({ ...msg })),
      appState,
      summary: generateSummary(messages),
      environment: {
        browser,
        os,
        viewport: appState.viewport,
      },
      screenshot,
    };
  };

  const downloadDump = async () => {
    setIsGeneratingDump(true);
    try {
      const dump = await generateDebugDump();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-dump-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingDump(false);
    }
  };

  const emailDump = async () => {
    setIsGeneratingDump(true);
    try {
      const dump = await generateDebugDump();
      const subject = `Debug Dump - CallVault - ${new Date().toISOString()}`;
      const body = `Debug dump generated at ${new Date().toISOString()}\n\n` +
        `Total messages: ${dump.messages.length}\n` +
        `Errors: ${dump.messages.filter(m => m.type === 'error').length}\n` +
        `Warnings: ${dump.messages.filter(m => m.type === 'warning').length}\n\n` +
        `URL: ${dump.appState.url}\n\n` +
        `--- Full dump below ---\n\n` +
        JSON.stringify(dump, null, 2);

      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1500))}...`;
      window.open(mailtoLink);
    } finally {
      setIsGeneratingDump(false);
    }
  };

  // Primary copy function - Markdown with AI pre-prompt and action trail
  const copyReport = async () => {
    const appState = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
    const markdown = formatAsMarkdown(messages, appState, actionTrail);
    await navigator.clipboard.writeText(markdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const copyMessageToClipboard = async (msg: DebugMessage) => {
    const singleMessage = {
      id: msg.id,
      type: msg.type,
      message: msg.message,
      source: msg.source,
      category: msg.category,
      timestamp: new Date(msg.timestamp).toISOString(),
      details: msg.details,
      stack: msg.stack,
      componentStack: msg.componentStack,
      isBookmarked: msg.isBookmarked,
    };
    await navigator.clipboard.writeText(JSON.stringify(singleMessage, null, 2));
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[9999] p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          unacknowledgedCount > 0 && !isOpen
            ? 'bg-red-500 text-white animate-pulse'
            : warningCount > 0 && !isOpen
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-800 text-white hover:bg-gray-700'
        }`}
        title={`Debug Console (${unacknowledgedCount} unread, ${errorCount} total errors, ${warningCount} warnings)`}
        data-debug-panel
      >
        <RiBugLine className="w-5 h-5" />
        {(unacknowledgedCount > 0 || (warningCount > 0 && !isOpen)) && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {unacknowledgedCount > 0 ? unacknowledgedCount : warningCount}
          </span>
        )}
      </button>

      {/* Debug Panel */}
      <div
        ref={panelRef}
        data-debug-panel
        className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-[9998] transform transition-all duration-300 ease-in-out flex flex-col ${
          isMaximized ? 'w-[80vw]' : 'w-[500px]'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <RiBugLine className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Debug Console</span>
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
              {filteredMessages.length}/{messages.length}
            </span>
            {bookmarkedCount > 0 && (
              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <RiBookmarkFill className="w-3 h-3" />
                {bookmarkedCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded p-0.5 mr-2">
              {[
                { key: 'list' as const, icon: RiListUnordered, label: 'List' },
                { key: 'analytics' as const, icon: RiBarChartLine, label: 'Stats' },
                { key: 'timeline' as const, icon: RiTimeLine, label: 'Timeline' },
                { key: 'webhooks' as const, icon: RiGlobeLine, label: 'Webhooks' },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-2 py-1 text-xs rounded transition-all flex items-center gap-1 ${
                    viewMode === key
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? (
                <RiFullscreenExitLine className="w-4 h-4 text-gray-500" />
              ) : (
                <RiFullscreenLine className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <button
              onClick={() => clearMessages()}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Clear all"
            >
              <RiDeleteBinLine className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Close"
            >
              <RiCloseLine className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <Button
            variant="outline"
            size="sm"
            onClick={copyReport}
            disabled={messages.length === 0}
            className="text-xs"
            title="Copy bug report - optimized for Claude Code"
          >
            {copiedReport ? (
              <RiCheckLine className="w-3.5 h-3.5 mr-1 text-green-500" />
            ) : (
              <RiFileCopyLine className="w-3.5 h-3.5 mr-1" />
            )}
            {copiedReport ? 'Copied!' : 'Copy Report'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadDump}
            disabled={isGeneratingDump}
            className="text-xs"
            title="Download full dump with screenshot (JSON)"
          >
            <RiDownloadLine className="w-3.5 h-3.5 mr-1" />
            {isGeneratingDump ? 'Generating...' : 'Download Full'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={emailDump}
            disabled={isGeneratingDump}
            className="text-xs"
          >
            <RiMailLine className="w-3.5 h-3.5 mr-1" />
            Email
          </Button>
        </div>

        {/* Filters */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <RiSearchLine className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            {[
              { key: 'all' as const, label: 'All', count: messages.length },
              { key: 'error' as const, label: 'Errors', count: errorCount, color: 'red' },
              { key: 'warning' as const, label: 'Warnings', count: warningCount, color: 'yellow' },
              { key: 'info' as const, label: 'Info', count: messages.filter(m => m.type === 'info').length, color: 'blue' },
            ].map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                  filter === key
                    ? color === 'red'
                      ? 'bg-red-500 text-white'
                      : color === 'yellow'
                      ? 'bg-yellow-500 text-white'
                      : color === 'blue'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label} ({count})
              </button>
            ))}
            {/* Quick mute Long Tasks button */}
            {(() => {
              const longTaskCount = messages.filter(m => m.message.includes('[LONG TASK]')).length;
              const isLongTaskMuted = isMessageIgnored({
                id: '', message: '[LONG TASK] Main thread blocked for Nms',
                source: 'performance', category: 'system', type: 'warning', timestamp: 0
              });
              if (longTaskCount > 0 || isLongTaskMuted) {
                return (
                  <button
                    onClick={() => {
                      if (isLongTaskMuted) {
                        // Find and unmute
                        const signature = Array.from(ignoredPatterns.entries())
                          .find(([, p]) => p.pattern.includes('[LONG TASK]'))?.[0];
                        if (signature) unignorePattern(signature);
                      } else {
                        addIgnorePattern('[LONG TASK] Main thread blocked for Nms', 'performance', 'system', 'Auto-muted Long Task warnings');
                      }
                    }}
                    className={`px-2 py-0.5 text-xs rounded-full transition-all flex items-center gap-1 ${
                      isLongTaskMuted
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50'
                    }`}
                    title={isLongTaskMuted ? 'Show Long Task warnings again' : 'Mute all Long Task warnings'}
                  >
                    {isLongTaskMuted ? <RiEyeLine className="w-3 h-3" /> : <RiEyeOffLine className="w-3 h-3" />}
                    {isLongTaskMuted ? 'Long Tasks Muted' : `Mute Long Tasks (${longTaskCount})`}
                  </button>
                );
              }
              return null;
            })()}
            {/* Show ignored toggle */}
            {ignoredCount > 0 && (
              <button
                onClick={() => setShowIgnored(!showIgnored)}
                className={`px-2 py-0.5 text-xs rounded-full transition-all flex items-center gap-1 ml-auto ${
                  showIgnored
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={showIgnored ? 'Hide ignored messages' : 'Show ignored messages'}
              >
                {showIgnored ? <RiEyeLine className="w-3 h-3" /> : <RiEyeOffLine className="w-3 h-3" />}
                Ignored ({ignoredCount})
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'analytics' && analyticsData ? (
            <div className="p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analyticsData.totalMessages}</div>
                  <div className="text-xs text-blue-800 dark:text-blue-300">Total Messages</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analyticsData.errorRate}%</div>
                  <div className="text-xs text-red-800 dark:text-red-300">Error Rate</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{analyticsData.warningRate}%</div>
                  <div className="text-xs text-yellow-800 dark:text-yellow-300">Warning Rate</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analyticsData.intervals.avg}</div>
                  <div className="text-xs text-green-800 dark:text-green-300">Avg Interval</div>
                </div>
              </div>

              {/* Timing Stats */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">Response Time Statistics</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Average:</span>{' '}
                    <span className="font-mono">{analyticsData.intervals.avg}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Median:</span>{' '}
                    <span className="font-mono">{analyticsData.intervals.median}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">P99:</span>{' '}
                    <span className="font-mono">{analyticsData.intervals.p99}</span>
                  </div>
                </div>
              </div>

              {/* By Category */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">By Category</h4>
                <div className="space-y-1">
                  {Object.entries(analyticsData.byCategory).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between text-xs">
                      <span className="capitalize text-gray-600 dark:text-gray-400">{cat}</span>
                      <span className="font-mono text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution Status */}
              {(resolvedCount > 0 || recurringCount > 0 || resolvedErrorsCount > 0) && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 text-sm mb-2 flex items-center gap-1">
                    <RiCheckDoubleLine className="w-4 h-4" />
                    Resolution Tracking
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-purple-500">Resolved:</span>{' '}
                      <span className="font-mono text-green-600 dark:text-green-400">{resolvedCount}</span>
                    </div>
                    <div>
                      <span className="text-purple-500">Recurring:</span>{' '}
                      <span className="font-mono text-orange-600 dark:text-orange-400">{recurringCount}</span>
                    </div>
                    <div>
                      <span className="text-purple-500">Tracked:</span>{' '}
                      <span className="font-mono">{resolvedErrorsCount}</span>
                    </div>
                  </div>
                  {recurringCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                      <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium mb-1">
                        ⚠️ Recurring Errors (previously resolved):
                      </div>
                      {messages.filter(m => m.resolutionStatus === 'recurring').slice(0, 3).map(msg => (
                        <div key={msg.id} className="text-xs text-purple-700 dark:text-purple-300 truncate">
                          {msg.message} (×{msg.recurrenceCount})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bookmarked */}
              {bookmarkedCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200 text-sm mb-2 flex items-center gap-1">
                    <RiBookmarkFill className="w-4 h-4" />
                    Bookmarked ({bookmarkedCount})
                  </h4>
                  <div className="space-y-1">
                    {messages.filter(m => m.isBookmarked).slice(0, 5).map(msg => (
                      <div key={msg.id} className="text-xs text-amber-700 dark:text-amber-300 truncate">
                        {new Date(msg.timestamp).toLocaleTimeString()}: {msg.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ignored Patterns */}
              {ignoredCount > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 text-sm mb-2 flex items-center gap-1">
                    <RiEyeOffLine className="w-4 h-4" />
                    Ignored Patterns ({ignoredCount})
                  </h4>
                  <div className="space-y-2">
                    {Array.from(ignoredPatterns.values()).map(pattern => (
                      <div key={pattern.signature} className="flex items-start justify-between gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="text-purple-700 dark:text-purple-300 truncate" title={pattern.pattern}>
                            {pattern.pattern}
                          </div>
                          <div className="text-[10px] text-purple-500 dark:text-purple-400">
                            {pattern.type} • Ignored {new Date(pattern.ignoredAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => unignorePattern(pattern.signature)}
                          className="p-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors flex-shrink-0"
                          title="Stop ignoring"
                        >
                          <RiEyeLine className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'timeline' && timelineData ? (
            <div className="p-4">
              {timelineData.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <RiTimeLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No timeline events</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-3">
                    {timelineData.map((event) => {
                      const formatTime = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
                      return (
                        <div key={event.id} className="relative flex items-start">
                          <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                            event.type === 'error'
                              ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30'
                              : event.type === 'warning'
                              ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30'
                              : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
                          } ${event.isBookmarked ? 'ring-2 ring-amber-400' : ''}`}>
                            <div className={`w-3 h-3 rounded-full ${
                              event.type === 'error' ? 'bg-red-500' :
                              event.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                          </div>
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize ${
                                event.type === 'error'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : event.type === 'warning'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}>
                                {event.type}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                +{formatTime(event.relativeTime)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 truncate">
                              {event.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'webhooks' ? (
            <div className="h-full overflow-hidden p-4">
              <WebhookDeliveryViewerV2 />
            </div>
          ) : (
            /* List View */
            <div className="p-2 space-y-2">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <RiBugLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No messages match your filters</p>
                </div>
              ) : (
                [...filteredMessages].reverse().map((message) => {
                  const isExpanded = expandedMessages.has(message.id);
                  const isResolved = message.resolutionStatus === 'resolved';
                  const isRecurring = message.resolutionStatus === 'recurring';
                  return (
                    <div
                      key={message.id}
                      className={`border-l-4 rounded-r-lg p-2 transition-all relative ${
                        isRecurring
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : isResolved
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 opacity-60'
                          : message.type === 'error'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : message.type === 'warning'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      } ${message.isBookmarked ? 'ring-2 ring-amber-300' : ''} ${isRecurring ? 'ring-2 ring-orange-400' : ''}`}
                    >
                      {/* Action buttons - Resolution, Copy and Bookmark */}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {/* Resolution button (errors only) */}
                        {message.type === 'error' && (
                          isResolved ? (
                            <button
                              onClick={() => unresolveError(message.id)}
                              className="p-1 rounded transition-all text-green-500 hover:text-green-600"
                              title="Mark as unresolved (reopen)"
                            >
                              <RiArrowGoBackLine className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => resolveError(message.id)}
                              className={`p-1 rounded transition-all ${
                                isRecurring
                                  ? 'text-orange-500 hover:text-green-500'
                                  : 'text-gray-300 hover:text-green-500'
                              }`}
                              title={isRecurring ? 'Re-resolve this recurring error' : 'Mark as resolved'}
                            >
                              <RiCheckDoubleLine className="w-4 h-4" />
                            </button>
                          )
                        )}
                        <button
                          onClick={() => copyMessageToClipboard(message)}
                          className={`p-1 rounded transition-all ${
                            copiedMessageId === message.id
                              ? 'text-green-500'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                          title={copiedMessageId === message.id ? 'Copied!' : 'Copy to clipboard'}
                        >
                          {copiedMessageId === message.id ? (
                            <RiCheckLine className="w-4 h-4" />
                          ) : (
                            <RiFileCopyLine className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleBookmark(message.id)}
                          className={`p-1 rounded transition-all ${
                            message.isBookmarked
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-gray-300 hover:text-amber-500'
                          }`}
                          title={message.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                        >
                          {message.isBookmarked ? (
                            <RiBookmarkFill className="w-4 h-4" />
                          ) : (
                            <RiBookmarkLine className="w-4 h-4" />
                          )}
                        </button>
                        {/* Ignore button - more visible */}
                        <button
                          onClick={() => ignoreMessage(message.id)}
                          className="p-1 rounded transition-all text-purple-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                          title="Ignore similar messages (hides all matching)"
                        >
                          <RiEyeOffLine className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-1 pr-20">
                        <span className={`text-[10px] font-medium uppercase ${
                          isRecurring ? 'text-orange-600' :
                          isResolved ? 'text-green-600' :
                          message.type === 'error' ? 'text-red-600' :
                          message.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {isRecurring ? '🔄 RECURRING' : isResolved ? '✓ RESOLVED' : message.type}
                        </span>
                        {isRecurring && message.recurrenceCount && (
                          <span className="text-[10px] bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200 px-1.5 py-0.5 rounded font-medium">
                            ×{message.recurrenceCount}
                          </span>
                        )}
                        {message.source && (
                          <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {message.source}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-xs text-gray-800 dark:text-gray-200 mb-1">
                        {message.message}
                      </p>

                      {(message.details || message.stack) && (
                        <div>
                          <button
                            onClick={() => toggleExpanded(message.id)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                          >
                            {isExpanded ? 'Hide details' : 'Show details'}
                          </button>
                          {isExpanded && (
                            <pre className="mt-1 text-[10px] bg-gray-900 text-gray-300 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-32">
                              {message.stack || message.details}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9997] bg-black/10 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          data-debug-panel
        />
      )}
    </>
  );
}

export function DebugPanel() {
  return (
    <DebugPanelErrorBoundary>
      <DebugPanelCore />
    </DebugPanelErrorBoundary>
  );
}
