import React from "react";
import { RiArrowLeftSLine, RiArrowRightSLine, RiArrowLeftDoubleLine, RiArrowRightDoubleLine } from "@remixicon/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export const PaginationControls = React.memo(({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = totalCount > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const endRecord = Math.min(page * pageSize, totalCount);
  
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-1 h-6 min-h-[24px]",
      "border-t border-border bg-card/50 backdrop-blur-md sticky bottom-0 z-10",
      className
    )}>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {startRecord}–{endRecord} of {totalCount}
      </span>

      <div className="flex items-center gap-0.5">
        <Select
          value={pageSize.toString()}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-14 h-5 text-[10px] border-0 bg-transparent px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => canGoPrevious && onPageChange(1)}
          disabled={!canGoPrevious}
          className="h-5 w-5"
        >
          <RiArrowLeftDoubleLine className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => canGoPrevious && onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className="h-5 w-5"
        >
          <RiArrowLeftSLine className="h-3 w-3" />
        </Button>

        <span className="text-[10px] text-muted-foreground tabular-nums px-1">
          {page}/{totalPages}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => canGoNext && onPageChange(page + 1)}
          disabled={!canGoNext}
          className="h-5 w-5"
        >
          <RiArrowRightSLine className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => canGoNext && onPageChange(totalPages)}
          disabled={!canGoNext}
          className="h-5 w-5"
        >
          <RiArrowRightDoubleLine className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});

PaginationControls.displayName = "PaginationControls";
