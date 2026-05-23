/**
 * Settings Category Pane (2nd Pane)
 *
 * Displays a list of settings categories for multi-pane navigation.
 * Categories are role-filtered - Users visible to TEAM/ADMIN, Admin visible to ADMIN only.
 *
 * ## Design Specification
 *
 * - **Position**: 2nd pane in the multi-pane layout (after sidebar)
 * - **Width**: 280px (fixed)
 * - **Purpose**: Category selection to trigger 3rd pane detail view
 * - **Pattern**: Microsoft Loop-inspired navigation
 *
 * @pattern settings-category-pane
 * @see docs/planning/settings-pane-allocation.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { SelectionButton } from "@/components/ui/selection-button";
import {
  RiUserLine,
  RiWalletLine,
  RiShieldLine,
  RiSettings3Line,
  RiRobot2Line,
  RiBuilding4Line,
  RiPlugLine,
} from "@remixicon/react";

export type SettingsCategory =
  | "account"
  | "billing"
  | "organizations"
  | "integrations"
  | "mcp"
  | "admin";

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles required to see this category. Empty array = visible to all. */
  requiredRoles?: Array<"ADMIN" | "TEAM">;
}

export const SETTINGS_CATEGORIES: CategoryItem[] = [
  {
    id: "account",
    label: "Account",
    description: "Profile and preferences",
    icon: RiUserLine,
  },
  {
    id: "billing",
    label: "Billing",
    description: "Plans and payments",
    icon: RiWalletLine,
  },
  {
    id: "organizations",
    label: "Organizations",
    description: "Manage workspaces and teams",
    icon: RiBuilding4Line,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect meeting platforms",
    icon: RiPlugLine,
  },
  {
    id: "mcp",
    label: "AI Integrations",
    description: "Connect AI tools to your calls",
    icon: RiRobot2Line,
  },
  {
    id: "admin",
    label: "Admin",
    description: "System administration",
    icon: RiShieldLine,
    requiredRoles: ["ADMIN"],
  },
];

interface SettingsCategoryPaneProps {
  /** Currently selected category ID */
  selectedCategory: SettingsCategory | null;
  /** Callback when a category is clicked */
  onCategorySelect: (category: SettingsCategory) => void;
  /** Additional CSS classes */
  className?: string;
}

export function SettingsCategoryPane({
  selectedCategory,
  onCategorySelect,
  className,
}: SettingsCategoryPaneProps) {
  const { isAdmin, isTeam } = useUserRole();

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Refs for category buttons to enable focus management
  const buttonRefs = React.useRef<Map<SettingsCategory, HTMLButtonElement>>(
    new Map(),
  );

  // Filter categories based on user role
  const visibleCategories = React.useMemo(() => {
    return SETTINGS_CATEGORIES.filter((category) => {
      // No role requirement = visible to all
      if (!category.requiredRoles || category.requiredRoles.length === 0) {
        return true;
      }
      // Check if user has any of the required roles
      if (category.requiredRoles.includes("ADMIN") && isAdmin) {
        return true;
      }
      if (category.requiredRoles.includes("TEAM") && (isTeam || isAdmin)) {
        return true;
      }
      return false;
    });
  }, [isAdmin, isTeam]);

  // Focus a category by index (wraps around)
  const focusCategoryByIndex = React.useCallback(
    (index: number) => {
      const categoryIds = visibleCategories.map((c) => c.id);
      const wrappedIndex =
        ((index % categoryIds.length) + categoryIds.length) %
        categoryIds.length;
      const categoryId = categoryIds[wrappedIndex];
      const button = buttonRefs.current.get(categoryId);
      button?.focus();
    },
    [visibleCategories],
  );

  // Keyboard navigation handler for individual items
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: SettingsCategory) => {
      const currentIndex = visibleCategories.findIndex(
        (c) => c.id === categoryId,
      );

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
          focusCategoryByIndex(visibleCategories.length - 1);
          break;
      }
    },
    [onCategorySelect, visibleCategories, focusCategoryByIndex],
  );

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        // Pane enter animation (slide + fade)
        "transition-all duration-500 ease-in-out",
        isMounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
        className,
      )}
      role="navigation"
      aria-label="Settings categories"
    >
      {/* Header */}
      <header className="px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiSettings3Line className="h-4 w-4 text-vibe-orange" />
            </div>
            <div>
              <h2
                className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none"
                id="settings-category-title"
              >
                Settings
              </h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">
                Preferences & Config
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="settings-category-title"
      >
        {visibleCategories.map((category) => {
          const isActive = selectedCategory === category.id;
          const IconComponent = category.icon;

          return (
            <div key={category.id} role="listitem" className="relative mb-1">
              <SelectionButton
                ref={
                  ((el: HTMLButtonElement | null) => {
                    if (el) {
                      buttonRefs.current.set(category.id, el);
                    } else {
                      buttonRefs.current.delete(category.id);
                    }
                  }) as unknown as React.Ref<HTMLElement>
                }
                selected={isActive}
                icon={
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                }
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

export default SettingsCategoryPane;
