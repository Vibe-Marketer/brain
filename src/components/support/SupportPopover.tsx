import * as React from 'react';
import {
  RiArrowRightSLine,
  RiBookOpenLine,
  RiCustomerService2Line,
  RiInformationLine,
  RiPlayCircleLine,
  RiQuestionLine,
  RiTicket2Line,
} from '@remixicon/react';
import { HowItWorksModal } from '@/components/onboarding/HowItWorksModal';
import { OnboardingVideoModal } from '@/components/onboarding/OnboardingVideoModal';
import { SupportTicketDialog } from '@/components/support/SupportTicketDialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { startTour } from '@/lib/tour';

interface SupportPopoverProps {
  isCollapsed?: boolean;
}

interface ActionItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

export function SupportPopover({ isCollapsed }: SupportPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [showHowItWorks, setShowHowItWorks] = React.useState(false);
  const [showVideo, setShowVideo] = React.useState(false);
  const [showTicketDialog, setShowTicketDialog] = React.useState(false);

  const actions = React.useMemo<ActionItem[]>(() => [
    {
      label: 'Watch the Onboarding Video',
      icon: RiPlayCircleLine,
      onClick: () => {
        setOpen(false);
        setShowVideo(true);
      },
    },
    {
      label: 'Take the Tour',
      icon: RiQuestionLine,
      onClick: () => {
        setOpen(false);
        startTour();
      },
    },
    {
      label: 'How It Works',
      icon: RiInformationLine,
      onClick: () => {
        setOpen(false);
        setShowHowItWorks(true);
      },
    },
    {
      label: 'Support Docs',
      icon: RiBookOpenLine,
      onClick: () => {
        setOpen(false);
        window.open('https://docs.callvaultai.com', '_blank', 'noopener,noreferrer');
      },
    },
    {
      label: 'Submit a Ticket',
      icon: RiTicket2Line,
      onClick: () => {
        setOpen(false);
        setShowTicketDialog(true);
      },
    },
  ], []);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative flex items-center rounded-lg',
              'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !isCollapsed && 'w-full px-3 py-2.5 gap-3',
              isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
            )}
            aria-label="Support"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
              <RiCustomerService2Line className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <span
              className={cn(
                'text-xs font-medium transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
                isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
              )}
            >
              Support
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" className="w-72 p-2">
          <div className="space-y-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                className="w-full justify-between"
                onClick={action.onClick}
              >
                <span className="flex items-center gap-2 text-sm">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </span>
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <HowItWorksModal open={showHowItWorks} onComplete={() => setShowHowItWorks(false)} />
      <OnboardingVideoModal
        open={showVideo}
        onOpenChange={setShowVideo}
        onStartSyncing={() => setShowVideo(false)}
      />
      <SupportTicketDialog open={showTicketDialog} onOpenChange={setShowTicketDialog} />
    </>
  );
}
