import { RiFolderAddLine, RiFolderReduceLine, RiFolderOpenLine } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionButton } from "./ActionButton";

interface CategorizeDropdownProps {
  categories: Array<{ id: string; name: string }>;
  onCategorize?: (categoryId: string) => void;
  onUncategorize?: () => void;
  onCreateNewCategory?: () => void;
}

export function CategorizeDropdown({
  categories,
  onCategorize,
  onUncategorize,
  onCreateNewCategory,
}: CategorizeDropdownProps) {
  if (!onCategorize) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={RiFolderAddLine} label="Categorize" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="bg-background border-border z-50 min-w-[200px]">
        {onUncategorize && (
          <>
            <DropdownMenuItem
              onClick={onUncategorize}
              className="gap-2 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10"
            >
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                <RiFolderReduceLine className="h-3.5 w-3.5" />
              </div>
              <span>Remove Folder</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {categories.length > 0 ? (
          categories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              onClick={() => onCategorize(category.id)}
              className="gap-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
            >
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <RiFolderOpenLine className="h-3.5 w-3.5" />
              </div>
              <span>{category.name}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="gap-2">
            <div className="p-1.5 rounded-md bg-muted">
              <RiFolderOpenLine className="h-3.5 w-3.5" />
            </div>
            <span>No categories available</span>
          </DropdownMenuItem>
        )}

        {onCreateNewCategory && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateNewCategory}
              className="gap-2 cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-muted transition-colors">
                <RiFolderAddLine className="h-3.5 w-3.5" />
              </div>
              <span>Create New Folder</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
