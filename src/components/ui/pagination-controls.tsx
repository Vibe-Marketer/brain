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
  const startRecord = ((page - 1) * pageSize) + 1;
  const endRecord = Math.min(page * pageSize, totalCount);
  
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 px-2 sm:px-4 py-3 border-t bg-white dark:bg-card", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground order-2 sm:order-1">
        <span className="hidden sm:inline">Showing {startRecord} to {endRecord} of {totalCount}</span>
        <span className="sm:hidden">{startRecord}-{endRecord} of {totalCount}</span>
        <Select 
          value={pageSize.toString()} 
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="hollow"
          size="icon"
          onClick={() => canGoPrevious && onPageChange(1)}
          disabled={!canGoPrevious}
          className="h-8 w-8"
        >
          <RiArrowLeftDoubleLine className="h-4 w-4" />
        </Button>

        <Button
          variant="hollow"
          size="icon"
          onClick={() => canGoPrevious && onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className="h-8 w-8"
        >
          <RiArrowLeftSLine className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1 px-3">
          <span className="text-sm font-medium min-w-[80px] text-center">
            Page {page} of {totalPages}
          </span>
        </div>
        
        <Button
          variant="hollow"
          size="icon"
          onClick={() => canGoNext && onPageChange(page + 1)}
          disabled={!canGoNext}
          className="h-8 w-8"
        >
          <RiArrowRightSLine className="h-4 w-4" />
        </Button>

        <Button
          variant="hollow"
          size="icon"
          onClick={() => canGoNext && onPageChange(totalPages)}
          disabled={!canGoNext}
          className="h-8 w-8"
        >
          <RiArrowRightDoubleLine className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

PaginationControls.displayName = "PaginationControls";
