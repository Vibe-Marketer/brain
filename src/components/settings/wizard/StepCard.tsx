import { ReactNode } from "react";

interface StepCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function StepCard({ icon, title, description }: StepCardProps) {
  return (
    <div className="relative py-3 px-4 pl-6 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-vibe-green"
        style={{
          clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)",
        }}
      />
      <div className="flex items-start gap-3">
        <div className="text-primary shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
