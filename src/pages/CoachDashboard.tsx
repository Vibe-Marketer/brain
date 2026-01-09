import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  RiSearchLine,
  RiUserHeartLine,
  RiCalendarLine,
  RiTimeLine,
  RiLoader2Line,
  RiFilterLine,
  RiCloseLine,
  RiEdit2Line,
  RiArrowUpDownLine,
  RiFileTextLine,
  RiUserSettingsLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCoachees,
  useSharedCalls,
  useCoachNotes,
  useCoachRelationships,
  useCoachShares,
} from "@/hooks/useCoachRelationships";
import { useTableSort } from "@/hooks/useTableSort";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { SharingRulesForm } from "@/components/sharing/SharingRulesForm";
import { CoacheeInviteDialog } from "@/components/sharing/CoacheeInviteDialog";
import { cn } from "@/lib/utils";
import type { CoachRelationshipWithUsers } from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface SharedCall {
  recording_id: number;
  call_name: string;
  recording_start_time: string;
  duration: string | null;
  coachee_email: string;
  coachee_name?: string | null;
  relationship_id: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * CoacheeSidebarItem - Displays a coachee in the sidebar
 */
interface CoacheeSidebarItemProps {
  email: string;
  name?: string | null;
  callCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function CoacheeSidebarItem({
  email,
  name,
  callCount,
  isSelected,
  onClick,
}: CoacheeSidebarItemProps) {
  const displayName = name || email.split("@")[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/30 text-primary"
          : "hover:bg-muted/50 text-foreground"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <Badge variant="secondary" className="text-xs">
        {callCount}
      </Badge>
    </button>
  );
}

/**
 * CallsTable - Table component for displaying shared calls
 */
interface CallsTableProps {
  calls: SharedCall[];
  onCallClick: (call: SharedCall) => void;
  showCoacheeColumn?: boolean;
}

function CallsTable({ calls, onCallClick, showCoacheeColumn = true }: CallsTableProps) {
  const { sortField, sortDirection, sortedData, handleSort } = useTableSort(
    calls,
    "recording_start_time"
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return "-";
    // Duration might be in ISO 8601 format or HH:MM:SS
    if (duration.includes("T")) {
      // Parse ISO 8601 duration (e.g., PT1H30M)
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || "0");
        const minutes = parseInt(match[2] || "0");
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
      }
    }
    // Try HH:MM:SS format
    const parts = duration.split(":");
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
    return duration;
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-xs rounded-md transition-colors cursor-pointer uppercase tracking-wide"
    >
      {children}
      <RiArrowUpDownLine
        className={cn(
          "ml-1 h-3.5 w-3.5",
          sortField === field ? "text-foreground" : "text-muted-foreground"
        )}
      />
    </button>
  );

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <RiFileTextLine className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No calls shared with you yet</p>
        <p className="text-xs mt-1 opacity-70">
          Calls will appear here once coachees share their recordings
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4">
              <SortButton field="call_name">Title</SortButton>
            </th>
            {showCoacheeColumn && (
              <th className="text-left py-3 px-4">
                <SortButton field="coachee_email">Coachee</SortButton>
              </th>
            )}
            <th className="text-left py-3 px-4">
              <SortButton field="recording_start_time">Date</SortButton>
            </th>
            <th className="text-left py-3 px-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duration
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((call) => (
            <tr
              key={call.recording_id}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => onCallClick(call)}
            >
              <td className="py-3 px-4">
                <p className="text-sm font-medium text-foreground truncate max-w-[300px]">
                  {call.call_name}
                </p>
              </td>
              {showCoacheeColumn && (
                <td className="py-3 px-4">
                  <p className="text-sm text-muted-foreground">
                    {call.coachee_name || call.coachee_email.split("@")[0]}
                  </p>
                </td>
              )}
              <td className="py-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RiCalendarLine className="h-4 w-4" />
                  <span>{formatDate(call.recording_start_time)}</span>
                  <span className="opacity-50">
                    {formatTime(call.recording_start_time)}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RiTimeLine className="h-4 w-4" />
                  <span>{formatDuration(call.duration)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CoachNoteEditor - Editor for private coach notes on a call
 */
interface CoachNoteEditorProps {
  callId: number;
  relationshipId: string;
  onClose: () => void;
}

function CoachNoteEditor({ callId, relationshipId, onClose }: CoachNoteEditorProps) {
  const { user } = useAuth();
  const {
    note,
    isLoading,
    saveNote,
    deleteNote,
    isSaving,
  } = useCoachNotes({
    callId,
    relationshipId,
    userId: user?.id,
    enabled: !!user?.id && !!callId && !!relationshipId,
  });

  const [noteText, setNoteText] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Initialize note text when note loads
  useEffect(() => {
    if (note) {
      setNoteText(note.note);
      setIsDirty(false);
    }
  }, [note]);

  const handleSave = async () => {
    if (!noteText.trim()) {
      toast.error("Note cannot be empty");
      return;
    }

    try {
      await saveNote(noteText);
      setIsDirty(false);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNote();
      setNoteText("");
      setIsDirty(false);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiEdit2Line className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Private Coach Note</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        This note is private and only visible to you.
      </p>
      <Textarea
        value={noteText}
        onChange={(e) => {
          setNoteText(e.target.value);
          setIsDirty(true);
        }}
        placeholder="Add your private coaching notes here..."
        rows={6}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={!note || isSaving}
        >
          DELETE
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "SAVING..." : "SAVE NOTE"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const CoachDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCoacheeId, setSelectedCoacheeId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [selectedCall, setSelectedCall] = useState<SharedCall | null>(null);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSharingRulesDialog, setShowSharingRulesDialog] = useState(false);
  const [configuringRelationship, setConfiguringRelationship] =
    useState<CoachRelationshipWithUsers | null>(null);

  // Hooks
  const { coachees, isLoading: coacheesLoading } = useCoachees({
    userId: user?.id,
    enabled: !!user?.id,
  });

  const { sharedCalls, isLoading: callsLoading, refetch: refetchCalls } = useSharedCalls({
    userId: user?.id,
    coacheeId: selectedCoacheeId || undefined,
    enabled: !!user?.id,
  });

  const { relationships, updateStatus, endRelationship, isUpdating } = useCoachRelationships({
    userId: user?.id,
    enabled: !!user?.id,
  });

  const { configureSharing, isUpdating: sharesUpdating } = useCoachShares({
    relationshipId: configuringRelationship?.id || null,
    enabled: !!configuringRelationship?.id,
  });

  // Filter calls by search query
  const filteredCalls = useMemo(() => {
    if (!searchQuery.trim()) return sharedCalls;
    const query = searchQuery.toLowerCase();
    return sharedCalls.filter(
      (call) =>
        call.call_name.toLowerCase().includes(query) ||
        call.coachee_email.toLowerCase().includes(query) ||
        (call.coachee_name?.toLowerCase().includes(query) ?? false)
    );
  }, [sharedCalls, searchQuery]);

  // Get selected coachee info
  const selectedCoachee = useMemo(() => {
    if (!selectedCoacheeId) return null;
    return coachees.find(
      (c) => c.relationship.coachee_user_id === selectedCoacheeId
    );
  }, [coachees, selectedCoacheeId]);

  // Get relationship for selected coachee
  const selectedRelationship = useMemo(() => {
    if (!selectedCoachee) return null;
    return selectedCoachee.relationship;
  }, [selectedCoachee]);

  // Handle call click - navigate to call detail
  const handleCallClick = (call: SharedCall) => {
    setSelectedCall(call);
    // Navigate to call detail page (read-only view for coach)
    // For now we'll show the note editor in a dialog
    setShowNoteEditor(true);
  };

  // Handle coachee selection
  const handleSelectCoachee = (coacheeId: string | null) => {
    setSelectedCoacheeId(coacheeId);
    if (isMobile) {
      setShowMobileSidebar(false);
    }
  };

  // Handle configure sharing
  const handleConfigureSharing = (relationship: CoachRelationshipWithUsers) => {
    setConfiguringRelationship(relationship);
    setShowSharingRulesDialog(true);
  };

  // Handle save sharing rules
  const handleSaveSharingRules = async (config: {
    shareAll: boolean;
    folderIds: string[];
    tagIds: string[];
  }) => {
    if (!configuringRelationship) return;

    try {
      await configureSharing({
        relationship_id: configuringRelationship.id,
        share_type: config.shareAll ? "all" : "folder",
        folder_ids: config.folderIds,
        tag_ids: config.tagIds,
      });
      toast.success("Sharing settings updated");
      setShowSharingRulesDialog(false);
      setConfiguringRelationship(null);
      refetchCalls();
    } catch {
      toast.error("Failed to update sharing settings");
    }
  };

  // Handle toggle pause
  const handleTogglePause = async (relationship: CoachRelationshipWithUsers) => {
    const newStatus = relationship.status === "active" ? "paused" : "active";
    try {
      await updateStatus(relationship.id, newStatus);
      toast.success(
        newStatus === "paused" ? "Relationship paused" : "Relationship resumed"
      );
    } catch {
      toast.error("Failed to update relationship status");
    }
  };

  // Handle end relationship
  const handleEndRelationship = async (relationship: CoachRelationshipWithUsers) => {
    try {
      await endRelationship(relationship.id);
      toast.success("Relationship ended");
      if (selectedCoacheeId === relationship.coachee_user_id) {
        setSelectedCoacheeId(null);
      }
    } catch {
      toast.error("Failed to end relationship");
    }
  };

  // Close mobile sidebar when breakpoint changes
  useEffect(() => {
    if (!isMobile) {
      setShowMobileSidebar(false);
    }
  }, [isMobile]);

  // Loading state
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <RiUserHeartLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to access the coach dashboard</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
      </div>
    );
  }

  // No coachees
  if (!coacheesLoading && coachees.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <RiUserHeartLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <h1 className="text-xl font-bold">Coach Dashboard</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You don&apos;t have any coachees yet. Invite coachees to share their calls with
          you and start coaching!
        </p>
        <Button onClick={() => setShowInviteDialog(true)}>
          <RiUserHeartLine className="h-4 w-4 mr-2" />
          INVITE COACHEE
        </Button>

        <CoacheeInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
        />
      </div>
    );
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && showMobileSidebar && (
        <div
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
            <h2 className="text-sm font-semibold uppercase tracking-tight">
              Coachees
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSidebar(false)}
              className="h-6 w-6"
            >
              <RiCloseLine className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {renderCoacheeList()}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="h-full flex gap-3 overflow-hidden p-1">
        {/* Coachee Sidebar - Desktop */}
        {!isMobile && (
          <div className="w-[280px] flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold uppercase tracking-tight">
                Coachees
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowInviteDialog(true)}
              >
                <RiUserHeartLine className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {renderCoacheeList()}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div className="px-4 md:px-10 pt-4 flex-shrink-0 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              {/* Mobile sidebar toggle */}
              {isMobile && (
                <Button
                  variant="hollow"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowMobileSidebar(true)}
                >
                  <RiUserHeartLine className="h-5 w-5" />
                </Button>
              )}
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                COACHING
              </p>
            </div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground uppercase tracking-wide mb-0.5">
                  {selectedCoachee
                    ? selectedCoachee.relationship.coachee_name ||
                      selectedCoachee.relationship.coachee_email?.split("@")[0]
                    : "ALL COACHEES"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCoachee
                    ? `${filteredCalls.length} shared calls`
                    : `${filteredCalls.length} calls from ${coachees.length} coachees`}
                </p>
              </div>
              {/* Search */}
              <div className="relative w-64 flex-shrink-0 hidden md:block">
                <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>

            {/* Selected coachee actions */}
            {selectedRelationship && (
              <div className="flex items-center gap-2 pb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <RiUserSettingsLine className="h-4 w-4 mr-2" />
                      MANAGE
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => handleConfigureSharing(selectedRelationship)}
                    >
                      Configure Sharing
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleTogglePause(selectedRelationship)}
                      disabled={isUpdating}
                    >
                      {selectedRelationship.status === "active"
                        ? "Pause Relationship"
                        : "Resume Relationship"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleEndRelationship(selectedRelationship)}
                      disabled={isUpdating}
                      className="text-destructive"
                    >
                      End Relationship
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedCoacheeId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCoacheeId(null)}
                  >
                    <RiFilterLine className="h-4 w-4 mr-2" />
                    VIEW ALL
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Calls Table */}
          <div className="flex-1 overflow-auto p-4 md:p-10">
            {callsLoading ? (
              <div className="flex items-center justify-center py-16">
                <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CallsTable
                calls={filteredCalls}
                onCallClick={handleCallClick}
                showCoacheeColumn={!selectedCoacheeId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Note Editor Dialog */}
      <Dialog open={showNoteEditor} onOpenChange={setShowNoteEditor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiFileTextLine className="h-5 w-5" />
              {selectedCall?.call_name}
            </DialogTitle>
            <DialogDescription>
              Add private notes about this call for your coaching records.
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <CoachNoteEditor
              callId={selectedCall.recording_id}
              relationshipId={selectedCall.relationship_id}
              onClose={() => setShowNoteEditor(false)}
            />
          )}
          <DialogFooter>
            <Link
              to={`/call/${selectedCall?.recording_id}`}
              className="text-sm text-primary hover:underline"
            >
              View Full Call Details
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Coachee Dialog */}
      <CoacheeInviteDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />

      {/* Sharing Rules Dialog */}
      <Dialog open={showSharingRulesDialog} onOpenChange={setShowSharingRulesDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Sharing</DialogTitle>
            <DialogDescription>
              Select which folders and tags to share with{" "}
              {configuringRelationship?.coachee_name ||
                configuringRelationship?.coachee_email?.split("@")[0]}
            </DialogDescription>
          </DialogHeader>
          <SharingRulesForm
            onSave={handleSaveSharingRules}
            onCancel={() => {
              setShowSharingRulesDialog(false);
              setConfiguringRelationship(null);
            }}
            isLoading={sharesUpdating}
          />
        </DialogContent>
      </Dialog>
    </>
  );

  // Helper function to render coachee list
  function renderCoacheeList() {
    if (coacheesLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {/* All Coachees option */}
        <CoacheeSidebarItem
          email="All Coachees"
          name="All Coachees"
          callCount={sharedCalls.length}
          isSelected={!selectedCoacheeId}
          onClick={() => handleSelectCoachee(null)}
        />

        <Separator className="my-2" />

        {/* Individual coachees */}
        {coachees.map((coachee) => (
          <CoacheeSidebarItem
            key={coachee.relationship.id}
            email={coachee.relationship.coachee_email || "Unknown"}
            name={coachee.relationship.coachee_name}
            callCount={coachee.callCount}
            isSelected={selectedCoacheeId === coachee.relationship.coachee_user_id}
            onClick={() =>
              handleSelectCoachee(coachee.relationship.coachee_user_id)
            }
          />
        ))}
      </div>
    );
  }
};

export default CoachDashboard;
