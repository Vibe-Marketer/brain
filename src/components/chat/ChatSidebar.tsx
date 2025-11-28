import * as React from 'react';
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

// ChatGPT-style compact session item
// Fixed height: 36px, single line, title truncates, menu always visible
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
  const title = session.title || 'New conversation';

  return (
    <div
      className={`
        group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer
        transition-colors duration-150 overflow-hidden
        ${isActive
          ? 'bg-cb-hover'
          : 'hover:bg-cb-hover/50'
        }
      `}
      onClick={() => onSelect(session.id)}
    >
      {/* Title - truncates with ellipsis */}
      <span
        className={`
          flex-1 min-w-0 truncate text-sm
          ${isActive ? 'text-cb-ink font-medium' : 'text-cb-ink-soft'}
        `}
        dir="auto"
      >
        {title}
      </span>

      {/* Pin indicator (small, inline) */}
      {session.is_pinned && (
        <RiPushpinFill className="h-3 w-3 text-cb-ink-muted flex-shrink-0 mr-1" aria-label="Pinned" />
      )}

      {/* 3-dot menu - ALWAYS visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-cb-border/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="Options"
          >
            <RiMoreLine className="h-5 w-5 text-cb-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
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
      {/* Sidebar wrapper - w-[280px] per guidelines */}
      <div
        className="bg-card h-full flex flex-col rounded-lg border border-border overflow-hidden"
        data-component="SIDEBAR"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-xs font-extrabold uppercase text-cb-ink">
            Chat History
          </h3>
          <Button variant="ghost" size="icon" onClick={onNewChat} aria-label="New chat">
            <RiAddLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Sessions list - compact padding */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-2 space-y-0.5 overflow-hidden">
            {/* Pinned sessions */}
            {pinnedSessions.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1">
                  <span className="text-[11px] text-cb-ink-muted">Pinned</span>
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
                  <div className="px-2 py-1">
                    <span className="text-[11px] text-cb-ink-muted">Recent</span>
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
                <RiChat3Line className="h-10 w-10 text-cb-ink-muted mb-3" aria-hidden="true" />
                <p className="text-sm text-cb-ink-soft mb-1">No conversations yet</p>
                <p className="text-xs text-cb-ink-muted">Start a new chat</p>
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
