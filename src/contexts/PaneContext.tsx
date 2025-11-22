import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PanePosition {
  x: number;
  y: number;
}

interface PaneContextType {
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
  floatingPaneOpen: boolean;
  floatingPanePosition: PanePosition;
  setLeftPaneOpen: (open: boolean) => void;
  setRightPaneOpen: (open: boolean) => void;
  setFloatingPaneOpen: (open: boolean) => void;
  setFloatingPanePosition: (position: PanePosition) => void;
}

const PaneContext = createContext<PaneContextType | undefined>(undefined);

interface PaneProviderProps {
  children: ReactNode;
}

export function PaneProvider({ children }: PaneProviderProps) {
  const [leftPaneOpen, setLeftPaneOpen] = useState(false);
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  const [floatingPaneOpen, setFloatingPaneOpen] = useState(false);
  
  // Load saved position from localStorage or default to center
  const [floatingPanePosition, setFloatingPanePosition] = useState<PanePosition>(() => {
    const saved = localStorage.getItem('floatingPanePosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 300 };
      }
    }
    return { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 300 };
  });

  // Save position to localStorage when it changes
  const handleSetFloatingPanePosition = (position: PanePosition) => {
    setFloatingPanePosition(position);
    localStorage.setItem('floatingPanePosition', JSON.stringify(position));
  };

  return (
    <PaneContext.Provider
      value={{
        leftPaneOpen,
        rightPaneOpen,
        floatingPaneOpen,
        floatingPanePosition,
        setLeftPaneOpen,
        setRightPaneOpen,
        setFloatingPaneOpen,
        setFloatingPanePosition: handleSetFloatingPanePosition,
      }}
    >
      {children}
    </PaneContext.Provider>
  );
}

export function usePaneContext() {
  const context = useContext(PaneContext);
  if (context === undefined) {
    throw new Error('usePaneContext must be used within a PaneProvider');
  }
  return context;
}
