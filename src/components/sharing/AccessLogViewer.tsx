import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RiArrowUpDownLine,
  RiLoader2Line,
  RiEyeLine,
  RiUserLine,
  RiTimeLine,
  RiGlobalLine,
  RiRefreshLine,
} from "@remixicon/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { useAccessLog } from "@/hooks/useSharing";
import type { ShareAccessLogWithUser } from "@/types/sharing";

interface AccessLogViewerProps {
  linkId: string | null;
  showHeader?: boolean;
  maxHeight?: string;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "Never";
  const date = formatDate(dateString);
  const time = formatTime(dateString);
  return `${date} at ${time}`;
};

export const AccessLogViewer = React.memo(({
  linkId,
  showHeader = true,
  maxHeight = "300px",
}: AccessLogViewerProps) => {
  const { accessLog, isLoading, refetch } = useAccessLog({
    linkId,
    enabled: !!linkId,
  });

  const { sortField, sortedData: sortedLogs, handleSort } = useTableSort<ShareAccessLogWithUser>(
    accessLog,
    "accessed_at"
  );

  const SortButton = ({ field, children }: { field: keyof ShareAccessLogWithUser; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-sm rounded-md transition-colors cursor-pointer"
    >
      {children}
      <RiArrowUpDownLine className={`h-3.5 w-3.5 ${sortField === field ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <RiLoader2Line className="h-5 w-5 animate-spin mr-2" />
        Loading access log...
      </div>
    );
  }

  if (!linkId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <RiEyeLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Select a share link to view access log</p>
      </div>
    );
  }

  if (accessLog.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <RiEyeLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No one has accessed this link yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <RiEyeLine className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Access Log ({accessLog.length} {accessLog.length === 1 ? "view" : "views"})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 px-2"
            title="Refresh access log"
          >
            <RiRefreshLine className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="border-cb-gray-light dark:border-cb-gray-dark">
        <div className="overflow-x-auto" style={{ maxHeight }}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
                <TableHead className="min-w-[180px] h-10 whitespace-nowrap text-xs md:text-sm">
                  <SortButton field="user_email">USER</SortButton>
                </TableHead>
                <TableHead className="min-w-[150px] h-10 whitespace-nowrap text-xs md:text-sm">
                  <SortButton field="accessed_at">ACCESSED</SortButton>
                </TableHead>
                <TableHead className="hidden md:table-cell min-w-[120px] h-10 whitespace-nowrap text-xs md:text-sm">
                  IP ADDRESS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="group h-10 hover:bg-gray dark:hover:bg-cb-panel-dark"
                >
                  <TableCell className="py-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <RiUserLine className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-foreground truncate max-w-[180px]">
                          {log.user_name || log.user_email || "Unknown User"}
                        </div>
                        {log.user_name && log.user_email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {log.user_email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-0.5">
                    <div className="flex items-center gap-2">
                      <RiTimeLine className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground tabular-nums">
                          {formatDate(log.accessed_at)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatTime(log.accessed_at)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-0.5">
                    {log.ip_address ? (
                      <div className="flex items-center gap-2">
                        <RiGlobalLine className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.ip_address}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
});

AccessLogViewer.displayName = "AccessLogViewer";

export default AccessLogViewer;
