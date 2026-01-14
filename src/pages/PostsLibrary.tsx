/**
 * Posts Library Page
 *
 * Displays all generated social posts with filtering, editing, and actions.
 *
 * Uses the 3-pane architecture:
 * - Pane 1: Navigation rail (via AppShell)
 * - Pane 2: ContentCategoryPane for content navigation
 * - Pane 3: Main content (this component's content)
 */

import { useEffect, useState } from 'react';
import {
  RiFileCopyLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiCheckLine,
  RiCloseLine,
  RiFilterLine,
  RiFileTextLine,
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
import { Textarea } from '@/components/ui/textarea';
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
import { ContentTableSkeleton } from '@/components/content-library/ContentTableSkeleton';
import {
  useContentItemsStore,
  usePosts,
  usePostsLoading,
  useItemsError,
} from '@/stores/contentItemsStore';
import type { ContentItem, ContentItemStatus } from '@/types/content-hub';
import { formatDistanceToNow } from 'date-fns';

export default function PostsLibrary() {
  const { toast } = useToast();

  const posts = usePosts();
  const isLoading = usePostsLoading();
  const error = useItemsError();

  const fetchPosts = useContentItemsStore((state) => state.fetchPosts);
  const updateItem = useContentItemsStore((state) => state.updateItem);
  const removeItem = useContentItemsStore((state) => state.removeItem);
  const markItemAsUsed = useContentItemsStore((state) => state.markItemAsUsed);
  const markItemAsDraft = useContentItemsStore((state) => state.markItemAsDraft);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentItemStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCopy = async (post: ContentItem) => {
    await navigator.clipboard.writeText(post.content_text);
    toast({
      title: 'Copied to clipboard',
      description: 'Post content has been copied.',
    });
  };

  const handleEdit = (post: ContentItem) => {
    setEditingId(post.id);
    setEditText(post.content_text);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateItem(editingId, { content_text: editText });
    setEditingId(null);
    setEditText('');
    toast({
      title: 'Post updated',
      description: 'Your changes have been saved.',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleToggleStatus = async (post: ContentItem) => {
    if (post.status === 'draft') {
      await markItemAsUsed(post.id);
      toast({
        title: 'Marked as used',
        description: 'Post has been marked as used.',
      });
    } else {
      await markItemAsDraft(post.id);
      toast({
        title: 'Marked as draft',
        description: 'Post has been marked as draft.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    const success = await removeItem(id);
    if (success) {
      toast({
        title: 'Post deleted',
        description: 'The post has been removed from your library.',
      });
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (searchTerm && !post.content_text.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && post.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = statusFilter !== 'all' || searchTerm;

  // Category counts for the secondary pane
  const categoryCounts = {
    posts: posts.length,
  };

  if (isLoading) {
    return (
      <AppShell config={{ secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} /> }}>
        <ContentTableSkeleton
          rowCount={5}
          columnCount={4}
          columnWidths={['', 'w-[100px]', 'w-[120px]', 'w-[150px]']}
        />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell config={{ secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} /> }}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => fetchPosts()}>Retry</Button>
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
              <RiFileTextLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                Posts
              </h2>
              <p className="text-xs text-ink-muted">
                {posts.length} post{posts.length !== 1 ? 's' : ''} saved
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
          placeholder="Search posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ContentItemStatus | 'all')}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setSearchTerm('');
            }}
          >
            <RiCloseLine className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredPosts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <RiFileTextLine className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium">No posts found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Generate posts from your hooks to get started'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {editingId === post.id ? (
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px]"
                        autoFocus
                      />
                    ) : (
                      <p className="whitespace-pre-wrap line-clamp-4">{post.content_text}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={post.status === 'used' ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(post)}
                    >
                      {post.status === 'used' ? 'Used' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editingId === post.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveEdit}
                          title="Save"
                        >
                          <RiCheckLine className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          <RiCloseLine className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(post)}
                          title="Copy"
                        >
                          <RiFileCopyLine className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(post)}
                          title="Edit"
                        >
                          <RiEdit2Line className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(post.id)}
                          title="Delete"
                        >
                          <RiDeleteBinLine className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
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
