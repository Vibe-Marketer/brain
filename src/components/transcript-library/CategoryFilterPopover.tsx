import { RiFolderOpenLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { FilterButton } from "./FilterButton";

interface CategoryFilterPopoverProps {
  selectedCategories?: string[];
  categories: any[];
  onCategoriesChange: (categories: string[]) => void;
}

export function CategoryFilterPopover({
  selectedCategories = [],
  categories,
  onCategoriesChange,
}: CategoryFilterPopoverProps) {
  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    if (checked) {
      onCategoriesChange([...selectedCategories, categoryId]);
    } else {
      onCategoriesChange(selectedCategories.filter((id) => id !== categoryId));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('categoryName') as string;

    if (!name?.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("call_categories")
        .insert({ name: name.trim(), user_id: user.id });

      if (error) throw error;

      e.currentTarget.reset();
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiFolderOpenLine className="h-3.5 w-3.5" />}
          label="Folder"
          count={selectedCategories.length}
          active={selectedCategories.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-card" align="start">
        <div className="space-y-0">
          <div className="p-4 pb-3">
            <div className="text-sm font-medium">Select Folders</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto px-2 pb-2">
            {categories.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center px-2">
                No folders yet. Add one below.
              </div>
            ) : (
              <div className="space-y-2 px-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => handleCategoryToggle(category.id, !!checked)}
                    />
                    <label
                      htmlFor={`cat-${category.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {category.description}
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t p-3">
            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <Input
                name="categoryName"
                placeholder="New category name"
                className="h-8 text-xs flex-1"
                maxLength={50}
                required
              />
              <Button type="submit" size="sm" className="h-8 text-xs">
                Add
              </Button>
            </form>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
