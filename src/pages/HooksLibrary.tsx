/**
 * Hooks Library Page
 *
 * Displays all generated hooks with filtering and actions.
 *
 * Uses the 3-pane architecture:
 * - Pane 1: Navigation rail (via AppShell)
 * - Pane 2: ContentCategoryPane for content navigation
 * - Pane 3: Main content (this component's content)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiStarLine,
  RiStarFill,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiSparklingLine,
  RiFilterLine,
  RiCloseLine,
  RiLightbulbLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/layout/AppShell';
import { ContentCategoryPane } from '@/components/panes/ContentCategoryPane';
import {
  useHooksLibraryStore,
  useHooks,
  useHooksLoading,
  useHooksError,
  useHookFilters,
} from '@/stores/hooksLibraryStore';
import type { Hook, EmotionCategory, HookStatus } from '@/types/content-hub';

const EMOTION_COLORS: Record<EmotionCategory, string> = {
  anger_outrage: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  awe_surprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  social_currency: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  relatable: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  practical_value: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  humor_sharp: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const EMOTION_LABELS: Record<EmotionCategory, string> = {
  anger_outrage: 'Anger/Outrage',
  awe_surprise: 'Awe/Surprise',
  social_currency: 'Social Currency',
  relatable: 'Relatable',
  practical_value: 'Practical Value',
  humor_sharp: 'Humor',
  neutral: 'Neutral',
};

export default function HooksLibrary() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const hooks = useHooks();
  const isLoading = useHooksLoading();
  const error = useHooksError();
  const filters = useHookFilters();

  const fetchHooks = useHooksLibraryStore((state) => state.fetchHooks);
  const toggleStar = useHooksLibraryStore((state) => state.toggleStar);
  const removeHook = useHooksLibraryStore((state) => state.removeHook);
  const updateFilters = useHooksLibraryStore((state) => state.updateFilters);
  const clearFilters = useHooksLibraryStore((state) => state.clearFilters);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleCopy = async (hook: Hook) => {
    await navigator.clipboard.writeText(hook.hook_text);
    toast({
      title: 'Copied to clipboard',
      description: 'Hook text has been copied.',
    });
  };

  const handleCreateContent = (hook: Hook) => {
    // Navigate to wizard with hook preloaded
    navigate(`/content/generators/call-content?hook=${hook.id}`);
  };

  const handleDelete = async (id: string) => {
    const success = await removeHook(id);
    if (success) {
      toast({
        title: 'Hook deleted',
        description: 'The hook has been removed from your library.',
      });
    }
  };

  const filteredHooks = hooks.filter((hook) => {
    if (searchTerm && !hook.hook_text.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = filters.emotion_category || filters.is_starred || searchTerm;

  // Category counts for the secondary pane
  const categoryCounts = {
    hooks: hooks.length,
  };

  if (isLoading) {
    return (
      <AppShell config={{ secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} /> }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vibe-orange" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell config={{ secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} /> }}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => fetchHooks()}>Retry</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell config={{ secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} /> }}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header - standardized detail pane pattern */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiLightbulbLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                Hooks
              </h2>
              <p className="text-xs text-ink-muted">
                {hooks.length} hook{hooks.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4 overflow-hidden">
          {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <RiFilterLine className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>

        <Input
          placeholder="Search hooks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />

        <Select
          value={filters.emotion_category || 'all'}
          onValueChange={(value) =>
            updateFilters({ emotion_category: value === 'all' ? null : (value as EmotionCategory) })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Emotion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emotions</SelectItem>
            {Object.entries(EMOTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.is_starred ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ is_starred: filters.is_starred ? null : true })}
        >
          <RiStarFill className="w-4 h-4 mr-1" />
          Starred
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearFilters();
              setSearchTerm('');
            }}
          >
            <RiCloseLine className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredHooks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <RiSparklingLine className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium">No hooks found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Generate hooks from your call transcripts to get started'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Star</TableHead>
                <TableHead>Hook Text</TableHead>
                <TableHead className="w-[120px]">Emotion</TableHead>
                <TableHead className="w-[80px]">Virality</TableHead>
                <TableHead className="w-[120px]">Topic</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHooks.map((hook) => (
                <TableRow key={hook.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStar(hook.id)}
                    >
                      {hook.is_starred ? (
                        <RiStarFill className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <RiStarLine className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2">{hook.hook_text}</p>
                  </TableCell>
                  <TableCell>
                    {hook.emotion_category && (
                      <Badge
                        variant="secondary"
                        className={EMOTION_COLORS[hook.emotion_category]}
                      >
                        {EMOTION_LABELS[hook.emotion_category]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {hook.virality_score && (
                      <span className="font-medium tabular-nums">
                        {hook.virality_score}/5
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hook.topic_hint && (
                      <span className="text-sm text-muted-foreground truncate block max-w-[100px]">
                        {hook.topic_hint}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(hook)}
                        title="Copy"
                      >
                        <RiFileCopyLine className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCreateContent(hook)}
                        title="Create Content"
                      >
                        <RiSparklingLine className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(hook.id)}
                        title="Delete"
                      >
                        <RiDeleteBinLine className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
        </div>
      </div>
    </AppShell>
  );
}
