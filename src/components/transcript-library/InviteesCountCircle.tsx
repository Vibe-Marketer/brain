interface InviteesCountCircleProps {
  invitees?: any[];
}

export function InviteesCountCircle({ invitees }: InviteesCountCircleProps) {
  if (!invitees || invitees.length === 0) {
    return <span className="text-muted-foreground text-[10px]">-</span>;
  }

  // Count how many have matched_speaker_display_name (these are participants who actually joined)
  const joinedCount = invitees.filter(inv => inv.matched_speaker_display_name).length;
  const invitedCount = invitees.length;
  const percentage = invitedCount > 0 ? Math.round((joinedCount / invitedCount) * 100) : 0;

  return (
    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
      <div className="relative h-7 w-7 flex-shrink-0">
        <svg className="h-7 w-7 -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-muted"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-vibe-green"
            strokeWidth="3"
            strokeDasharray={`${percentage} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold">{percentage}</span>
        </div>
      </div>
      <div className="text-left">
        <div className="text-[10px]">
          <span className="font-bold">{joinedCount}</span>
          <span className="text-muted-foreground ml-1">Joined</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {invitedCount} Invited
        </div>
      </div>
    </div>
  );
}
