import * as React from 'react';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiPushpinLine,
  RiPushpinFill,
  RiArchiveLine,
  RiChat3Line,
  RiMoreLine,
  RiEditLine,
  RiListCheck,
  RiCloseLine,
} from '@remixicon/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
// Removed ScrollArea import to fix radix-ui infinite loop bug
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
  onRenameSession: (sessionId: string, title: string) => void;
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
  onRename: (sessionId: string, title: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (sessionId: string) => void;
}

const SessionItem = React.memo(function SessionItem({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onRename,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}: SessionItemProps) {
  const title = session.title || 'New conversation';
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(title);

  React.useEffect(() => {
    setDraftTitle(title);
    setIsRenaming(false);
  }, [session.id, title]);

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) return;

    if (isSelectionMode && onToggleSelection) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelection(session.id);
    } else {
      onSelect(session.id);
    }
  };

  const startRename = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setDraftTitle(title);
    setIsRenaming(true);
  };

  const cancelRename = React.useCallback(() => {
    setDraftTitle(title);
    setIsRenaming(false);
  }, [title]);

  const saveRename = React.useCallback(() => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === title) {
      setIsRenaming(false);
      setDraftTitle(title);
      return;
    }
    onRename(session.id, nextTitle);
    setIsRenaming(false);
  }, [draftTitle, onRename, session.id, title]);

  return (
    <div
      className={`
        group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer
        transition-colors duration-150 overflow-hidden
        ${isActive && !isSelectionMode
          ? 'bg-hover'
          : 'hover:bg-hover/50'
        }
      `}
      onClick={handleClick}
    >
      {isSelectionMode && (
         <div className="mr-2 flex-shrink-0">
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={() => onToggleSelection && onToggleSelection(session.id)}
              className="h-4 w-4"
              onClick={(e) => e.stopPropagation()}
            />
         </div>
      )}

      {/* Title - truncates with ellipsis */}
      {isRenaming ? (
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveRename();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
          autoFocus
          maxLength={120}
          className="flex-1 min-w-0 h-7 px-2 rounded-md border border-border bg-card text-sm text-ink"
          aria-label="Rename chat"
        />
      ) : (
        <span
          className={`
            flex-1 min-w-0 truncate text-sm
            ${isActive && !isSelectionMode ? 'text-ink font-medium' : 'text-ink-soft'}
          `}
          dir="auto"
          onDoubleClick={startRename}
          title="Double-click to rename"
        >
          {title}
        </span>
      )}

      {/* Pin indicator (small, inline) */}
      {session.is_pinned && (
        <RiPushpinFill className="h-3 w-3 text-ink-muted flex-shrink-0 mr-1" aria-label="Pinned" />
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
            <RiMoreLine className="h-5 w-5 text-ink-muted" />
          </button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            <RiEditLine className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
  onRenameSession,
}: ChatSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);
  
  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedSessions, setSelectedSessions] = React.useState<string[]>([]);

  const toggleSelection = React.useCallback((sessionId: string) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  }, []);

  const selectAll = React.useCallback(() => {
    if (selectedSessions.length === sessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(sessions.map(s => s.id));
    }
  }, [sessions, selectedSessions]);

  const handleDeleteClick = React.useCallback((sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = React.useCallback(() => {
    if (sessionToDelete === 'BULK_DELETE') {
       // Bulk delete
       selectedSessions.forEach(id => onDeleteSession(id));
       setSelectedSessions([]);
       setIsSelectionMode(false);
       setSessionToDelete(null);
       setDeleteDialogOpen(false);
    } else if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
      setSessionToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [sessionToDelete, onDeleteSession, selectedSessions]);
  const pinnedSessions = React.useMemo(() => {
    if (!sessions || !Array.isArray(sessions)) return [];
    return sessions.filter((s) => s?.is_pinned);
  }, [sessions]);
  const unpinnedSessions = React.useMemo(() => {
    if (!sessions || !Array.isArray(sessions)) return [];
    return sessions.filter((s) => s && !s.is_pinned);
  }, [sessions]);



  return (
    <>
      {/* Sidebar wrapper - matches Library panel styling from LoopLayoutDemo */}
      <div
        className="h-full flex flex-col"
        data-component="SIDEBAR"
      >
        {/* Header - standardized pattern matching other category panes */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-cb-card/50">
          <div
            className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
            aria-hidden="true"
          >
            <RiChat3Line className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
              Conversations
            </h2>
            <p className="text-xs text-ink-muted">
              {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
             {/* Bulk Selection Toggle */}
             {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedSessions([]);
                }}
                className={`h-6 w-6 rounded-full ${isSelectionMode ? "bg-hover text-ink" : ""}`}
                aria-label={isSelectionMode ? "Cancel selection" : "Select chats"}
              >
                {isSelectionMode ? <RiCloseLine className="w-4 h-4 opacity-70" /> : <RiListCheck className="w-4 h-4 opacity-70" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={onNewChat} aria-label="New chat">
              <RiAddLine className="w-4 h-4 opacity-70" />
            </Button>
          </div>
        </header>
        
        {/* Bulk Actions Header */}
        {isSelectionMode && (
          <div className="px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 bg-white/30 dark:bg-black/10">
            <div className="flex items-center gap-2">
               <Checkbox 
                  checked={selectedSessions.length === sessions.length && sessions.length > 0}
                  onCheckedChange={selectAll}
                  className="h-4 w-4"
                  aria-label="Select all"
               />
               <span className="text-xs font-medium text-ink-soft">{selectedSessions.length} selected</span>
            </div>
             {selectedSessions.length > 0 && (
               <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={() => handleDeleteClick('BULK_DELETE')}
                >
                  Delete
                </Button>
             )}
          </div>
        )}

        {/* Sessions list - matches Library panel styling */}
        <div className="flex-1 overflow-hidden pt-2">
          <div className="h-full overflow-y-auto">
            <div className="px-2 space-y-0.5">
            {/* Pinned sessions */}
            {pinnedSessions.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1">
                  <span className="text-[11px] text-ink-muted">Pinned</span>
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
                    onRename={onRenameSession}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedSessions.includes(session.id)}
                    onToggleSelection={toggleSelection}
                  />
                ))}
              </div>
            )}

            {/* Recent sessions */}
            {unpinnedSessions.length > 0 && (
              <div>
                {pinnedSessions.length > 0 && (
                  <div className="px-2 py-1">
                    <span className="text-[11px] text-ink-muted">Recent</span>
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
                    onRename={onRenameSession}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedSessions.includes(session.id)}
                    onToggleSelection={toggleSelection}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <RiChat3Line className="h-10 w-10 text-ink-muted mb-3" aria-hidden="true" />
                <p className="text-sm text-ink-soft mb-1">No conversations yet</p>
                <p className="text-xs text-ink-muted">Start a new chat</p>
              </div>
            )}
            </div>
          </div>
        </div>
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
            <AlertDialogCancel asChild>
              <Button variant="hollow">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
