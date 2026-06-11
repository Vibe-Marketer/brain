import * as React from "react";
import { cn } from "@/lib/utils";
import { SelectionButton } from "@/components/ui/selection-button";
import {
  RiDashboardLine,
  RiTicket2Line,
  RiTeamLine,
  RiRobotLine,
  RiHistoryLine,
  RiShieldLine,
} from "@remixicon/react";

/**
 * Admin Center sections (16-01 Dashboard/Tickets + 16-02 Users + 16-03 QA/Audit).
 * Feature Flags were deleted on main and are intentionally absent (no FlagsSection).
 */
export type AdminCategory = "dashboard" | "tickets" | "users" | "qa" | "audit";

interface CategoryItem {
  id: AdminCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_CATEGORIES: CategoryItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "System overview",
    icon: RiDashboardLine,
  },
  {
    id: "tickets",
    label: "Tickets",
    description: "Bugs, tasks, and support",
    icon: RiTicket2Line,
  },
  {
    id: "users",
    label: "Users",
    description: "Roles, access, and plans",
    icon: RiTeamLine,
  },
  {
    id: "qa",
    label: "QA",
    description: "Crawler runs and findings",
    icon: RiRobotLine,
  },
  {
    id: "audit",
    label: "Audit",
    description: "Admin and ticket activity",
    icon: RiHistoryLine,
  },
];

interface AdminCategoryPaneProps {
  selectedCategory: AdminCategory | null;
  onCategorySelect: (category: AdminCategory) => void;
  className?: string;
}

export function AdminCategoryPane({
  selectedCategory,
  onCategorySelect,
  className,
}: AdminCategoryPaneProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const buttonRefs = React.useRef<Map<AdminCategory, HTMLButtonElement>>(new Map());

  const focusCategoryByIndex = React.useCallback(
    (index: number) => {
      const categoryIds = ADMIN_CATEGORIES.map((c) => c.id);
      const wrappedIndex = ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
      const categoryId = categoryIds[wrappedIndex];
      const button = buttonRefs.current.get(categoryId);
      button?.focus();
    },
    []
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: AdminCategory) => {
      const currentIndex = ADMIN_CATEGORIES.findIndex((c) => c.id === categoryId);

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          onCategorySelect(categoryId);
          break;
        case "ArrowDown":
          event.preventDefault();
          focusCategoryByIndex(currentIndex + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusCategoryByIndex(currentIndex - 1);
          break;
        case "Home":
          event.preventDefault();
          focusCategoryByIndex(0);
          break;
        case "End":
          event.preventDefault();
          focusCategoryByIndex(ADMIN_CATEGORIES.length - 1);
          break;
      }
    },
    [onCategorySelect, focusCategoryByIndex]
  );

  return (
    <div
      className={cn(
        "h-full flex flex-col transition-all duration-500 ease-in-out",
        isMounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
        className
      )}
      role="navigation"
      aria-label="Admin categories"
    >
      <header className="px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiShieldLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none" id="admin-category-title">
                Admin
              </h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">
                System Control
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-2 px-2" role="list" aria-labelledby="admin-category-title">
        {ADMIN_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const IconComponent = category.icon;

          return (
            <div key={category.id} role="listitem" className="relative mb-1">
              <SelectionButton
                ref={((el: HTMLButtonElement | null) => {
                  if (el) {
                    buttonRefs.current.set(category.id, el);
                  } else {
                    buttonRefs.current.delete(category.id);
                  }
                }) as unknown as React.Ref<HTMLElement>}
                selected={isActive}
                icon={<IconComponent className={cn("h-4 w-4 transition-colors duration-300", isActive ? "text-vibe-orange" : "text-muted-foreground")} />}
                label={category.label}
                description={category.description}
                size="sm"
                showChevron
                onClick={() => onCategorySelect(category.id)}
                onKeyDown={(e) => handleKeyDown(e, category.id)}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}`}
              />
            </div>
          );
        })}
      </div>
      <footer className="shrink-0 px-4 py-2" />
    </div>
  );
}

export default AdminCategoryPane;
