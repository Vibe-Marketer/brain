import { RiDownloadLine, RiSparkling2Line } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionButton } from "./ActionButton";

interface ExportDropdownProps {
  onExport: (format: 'pdf' | 'docx' | 'txt' | 'json' | 'zip') => void;
  onSmartExport: () => void;
}

export function ExportDropdown({ onExport, onSmartExport }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={RiDownloadLine} label="Download" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSmartExport}>
          <RiSparkling2Line className="mr-2 h-4 w-4" />
          Smart Export (LLM-Optimized)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Export</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onExport('pdf')}>
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('docx')}>
          Export as DOCX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('txt')}>
          Export as TXT
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExport('json')}>
          Export as JSON (with metadata)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('zip')}>
          Export all as ZIP
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
