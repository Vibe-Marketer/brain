import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CheckboxCardProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  badge: string;
  badgeVariant: "required" | "recommended" | "coming-soon";
}

export function CheckboxCard({
  id,
  label,
  checked,
  onCheckedChange,
  badge,
  badgeVariant,
}: CheckboxCardProps) {
  const badgeStyles = {
    required: "text-destructive",
    recommended: "text-vibe-orange dark:text-vibe-orange",
    "coming-soon": "text-muted-foreground",
  };

  return (
    <div className="relative py-2 px-4 pl-6 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6",
          checked ? "bg-vibe-orange" : "bg-red-500"
        )}
        style={{
          clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
        }}
      />
      <div className="flex items-center gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(checked) => onCheckedChange(checked === true)}
        />
        <Label htmlFor={id} className="flex-1 cursor-pointer flex items-center justify-between">
          <span className="font-medium">{label}</span>
          <span className={cn("text-xs font-semibold uppercase", badgeStyles[badgeVariant])}>
            {badge}
          </span>
        </Label>
      </div>
    </div>
  );
}
