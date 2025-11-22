"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface DockApp {
  id: string;
  name: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick?: (appId: string) => void;
  openApps?: string[];
  className?: string;
}

export function MacOSDock({ apps, onAppClick, openApps = [], className }: MacOSDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number>(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      setMouseX(e.clientX - rect.left);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const getIconScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    return index === hoveredIndex ? 1.2 : 1;
  };

  return (
    <div
      ref={dockRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-end gap-2 px-3 py-2",
        "bg-white/30 backdrop-blur-md",
        "border border-border rounded-2xl shadow-2xl",
        className,
      )}
    >
      {apps.map((app, index) => {
        const scale = getIconScale(index);
        const isOpen = openApps.includes(app.id);

        return (
          <div key={app.id} className="relative flex flex-col items-center" onMouseEnter={() => setHoveredIndex(index)}>
            <button
              onClick={() => {
                app.onClick?.();
                onAppClick?.(app.id);
              }}
              className={cn(
                "relative flex items-center justify-center",
                "w-12 h-12 rounded-xl",
                "transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
              style={{
                transform: `scale(${scale}) translateY(${-Math.abs(scale - 1) * 10}px)`,
              }}
              title={app.name}
            >
              {app.icon}
            </button>

            {isOpen && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />}
          </div>
        );
      })}
    </div>
  );
}
