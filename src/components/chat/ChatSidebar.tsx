import * as React from 'react';
import { format } from 'date-fns';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiPushpinLine,
  RiPushpinFill,
  RiArchiveLine,
  RiChat3Line,
  RiMoreLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChatSession {
  id: string;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onTogglePin: (sessionId: string, isPinned: boolean) => void;
  onToggleArchive: (sessionId: string, isArchived: boolean) => void;
}

// Helper functions extracted outside component for better performance
const formatSessionDate = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return format(date, 'MMM d');
};

const getSessionTitle = (session: ChatSession): string => {
  return session.title || 'New conversation';
};

// Extracted SessionItem component with React.memo for performance
interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (sessionId: string) => void;
  onTogglePin: (sessionId: string, isPinned: boolean) => void;
  onToggleArchive: (sessionId: string, isArchived: boolean) => void;
  onDelete: (sessionId: string) => void;
}

const SessionItem = React.memo(function SessionItem({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: SessionItemProps) {
  return (
    <div
      className={`group relative flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors cursor-pointer ${
        isActive
          ? 'bg-cb-vibe-green/10 border-l-[3px] border-cb-vibe-green pl-[9px]'
          : 'hover:bg-cb-ink-subtle/5 border-l-[3px] border-transparent pl-[9px]'
      }`}
      onClick={() => onSelect(session.id)}
    >
      <RiChat3Line
        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
          isActive ? 'text-cb-ink-primary' : 'text-cb-ink-muted'
        }`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-sm font-medium truncate ${
              isActive ? 'text-cb-ink-primary' : 'text-cb-ink-secondary'
            }`}
          >
            {getSessionTitle(session)}
          </h3>
          {session.is_pinned && (
            <RiPushpinFill className="h-3 w-3 text-cb-ink-muted flex-shrink-0" aria-label="Pinned" />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-cb-ink-muted">
            {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
          </span>
          <span className="text-xs text-cb-ink-muted">•</span>
          <span className="text-xs text-cb-ink-muted">
            {formatSessionDate(session.last_message_at || session.created_at)}
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="hollow"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Session options"
          >
            <RiMoreLine className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(session.id, !session.is_pinned);
            }}
          >
            {session.is_pinned ? (
              <>
                <RiPushpinLine className="h-4 w-4 mr-2" />
                Unpin
              </>
            ) : (
              <>
                <RiPushpinFill className="h-4 w-4 mr-2" />
                Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive(session.id, !session.is_archived);
            }}
          >
            <RiArchiveLine className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            className="text-red-600 dark:text-red-400"
          >
            <RiDeleteBinLine className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  onTogglePin,
  onToggleArchive,
}: ChatSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);

  // Memoize filtered sessions to prevent unnecessary recalculations
  const pinnedSessions = React.useMemo(() => sessions.filter((s) => s.is_pinned), [sessions]);
  const unpinnedSessions = React.useMemo(() => sessions.filter((s) => !s.is_pinned), [sessions]);

  const handleDeleteClick = React.useCallback((sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = React.useCallback(() => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
      setSessionToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [sessionToDelete, onDeleteSession]);

  return (
    <>
      <div className="flex h-full flex-col bg-card border-r border-cb-border-primary">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cb-border-primary px-4 py-3">
          <h2 className="font-montserrat text-sm font-extrabold uppercase text-cb-ink-primary">
            Conversations
          </h2>
          <Button variant="hollow" size="icon" onClick={onNewChat} aria-label="New chat">
            <RiAddLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Sessions list */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {/* Pinned sessions */}
            {pinnedSessions.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 mb-1">
                  <span className="text-xs font-medium text-cb-ink-muted uppercase">Pinned</span>
                </div>
                {pinnedSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSessionSelect}
                    onTogglePin={onTogglePin}
                    onToggleArchive={onToggleArchive}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            )}

            {/* Recent sessions */}
            {unpinnedSessions.length > 0 && (
              <div>
                {pinnedSessions.length > 0 && (
                  <div className="px-3 py-1 mb-1">
                    <span className="text-xs font-medium text-cb-ink-muted uppercase">Recent</span>
                  </div>
                )}
                {unpinnedSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSessionSelect}
                    onTogglePin={onTogglePin}
                    onToggleArchive={onToggleArchive}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <RiChat3Line className="h-12 w-12 text-cb-ink-muted mb-3" aria-hidden="true" />
                <p className="text-sm text-cb-ink-secondary mb-1">No conversations yet</p>
                <p className="text-xs text-cb-ink-muted">
                  Start a new chat to begin asking questions
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
