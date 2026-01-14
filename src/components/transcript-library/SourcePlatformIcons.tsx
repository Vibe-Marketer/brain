import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Helper to extract size from Tailwind className
 * Parses h-X w-X classes to get pixel size
 */
function getSizeFromClassName(className?: string): number | undefined {
  if (!className) return undefined;
  const match = className.match(/(?:^|\s)h-(\d+(?:\.\d+)?)/);
  if (match) {
    const value = parseFloat(match[1]);
    // Tailwind h-4 = 16px, h-5 = 20px, h-6 = 24px, etc.
    return value * 4;
  }
  return undefined;
}

/**
 * Fathom icon - white "F" arrows on black circular background
 */
export function FathomIcon({ className, size }: IconProps) {
  const computedSize = size ?? getSizeFromClassName(className) ?? 16;
  return (
    <svg
      width={computedSize}
      height={computedSize}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Black circular background */}
      <circle cx="50" cy="50" r="50" fill="#000000" />
      {/* Fathom logo scaled and centered */}
      <g transform="translate(15, 15) scale(0.07)">
        <path
          d="M0,668.7v205.78c0,53.97,34.24,102.88,85.8,119.08,87.48,27.49,167.88-36.99,167.88-120.22v-77.45L0,668.7Z"
          fill="#007299"
        />
        <path
          d="M873.72,626.07c-19.05,0-38.38-4.3-56.58-13.38L72.78,241.43C11.15,210.69-17.51,136.6,11.18,74.05,41.2,8.59,119.26-18.53,183.23,13.38l744.25,371.21c62.45,31.15,91,109.08,59.79,171.43-22.22,44.38-67.02,70.05-113.55,70.05Z"
          fill="#00beff"
        />
        <path
          d="M500.09,813.66c-19.05,0-38.38-4.3-56.58-13.38l-370.72-184.9c-61.63-30.74-90.29-104.82-61.61-167.37,30.02-65.46,108.08-92.59,172.06-60.68l370.62,184.85c62.45,31.15,91,109.08,59.79,171.43-22.22,44.38-67.02,70.05-113.55,70.05Z"
          fill="#00beff"
        />
      </g>
    </svg>
  );
}

/**
 * Google Meet icon - Google "G" on white circular background with subtle border
 */
export function GoogleMeetIcon({ className, size }: IconProps) {
  const computedSize = size ?? getSizeFromClassName(className) ?? 16;
  return (
    <svg
      width={computedSize}
      height={computedSize}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* White circular background with subtle gray border */}
      <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="2" />
      {/* Google "G" logo - simplified and centered */}
      <g transform="translate(18, 18) scale(0.64)">
        <path
          d="M99.9,51.1c0-3.5-0.3-6.9-0.9-10.2H51v19.3h27.4c-1.2,6.3-4.8,11.6-10.1,15.2v12.6h16.4C93.3,79.6,99.9,66.6,99.9,51.1z"
          fill="#4285F4"
        />
        <path
          d="M51,100c13.7,0,25.2-4.5,33.6-12.3l-16.4-12.6c-4.5,3-10.3,4.8-17.2,4.8c-13.2,0-24.4-8.9-28.4-20.9H5.6v13C14.1,88.6,31.4,100,51,100z"
          fill="#34A853"
        />
        <path
          d="M22.6,59.1c-1-3-1.6-6.2-1.6-9.5s0.6-6.5,1.6-9.5V27.1H5.6C2,34.3,0,42.4,0,51s2,16.7,5.6,23.9L22.6,59.1z"
          fill="#FBBC05"
        />
        <path
          d="M51,20.1c7.4,0,14.1,2.6,19.4,7.6l14.5-14.5C76.1,5.1,64.6,0,51,0C31.4,0,14.1,11.4,5.6,28.1l17,13C26.6,29,37.8,20.1,51,20.1z"
          fill="#EA4335"
        />
      </g>
    </svg>
  );
}

/**
 * Zoom icon - video camera on blue circular background (already circular in original)
 */
export function ZoomIcon({ className, size }: IconProps) {
  const computedSize = size ?? getSizeFromClassName(className) ?? 16;
  return (
    <svg
      width={computedSize}
      height={computedSize}
      viewBox="0 0 50.667 50.667"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <path
        d="M25.333 50.667c13.992 0 25.334-11.343 25.334-25.334S39.325 0 25.333 0 0 11.342 0 25.333s11.342 25.334 25.333 25.334z"
        fill="#2196f3"
      />
      <path
        clipRule="evenodd"
        d="M14.866 32.574h16.755V20.288c0-1.851-1.5-3.351-3.351-3.351H11.515v12.286c0 1.851 1.5 3.351 3.351 3.351zm18.988-4.467l6.702 4.467V16.937l-6.701 4.468z"
        fill="#fff"
        fillRule="evenodd"
      />
    </svg>
  );
}

type SourcePlatform = 'fathom' | 'zoom' | 'google_meet';

interface SourcePlatformIndicatorProps {
  /** Primary source platform */
  sourcePlatform?: string | null;
  /** Array of merged source platforms (for merged meetings) */
  mergedFrom?: Array<{ source_platform?: string }> | null;
  /** Size of each icon in pixels */
  size?: number;
}

/**
 * Displays source platform icons in a horizontal stack.
 * Fathom is always shown first (leftmost).
 * Includes a tooltip showing all sync sources.
 */
export function SourcePlatformIndicator({
  sourcePlatform,
  mergedFrom,
  size = 14,
}: SourcePlatformIndicatorProps) {
  // Collect all unique platforms
  const platforms = new Set<SourcePlatform>();

  if (sourcePlatform === 'fathom') platforms.add('fathom');
  else if (sourcePlatform === 'zoom') platforms.add('zoom');
  else if (sourcePlatform === 'google_meet') platforms.add('google_meet');

  // Add merged platforms
  if (mergedFrom && mergedFrom.length > 0) {
    mergedFrom.forEach(merged => {
      if (merged.source_platform === 'fathom') platforms.add('fathom');
      else if (merged.source_platform === 'zoom') platforms.add('zoom');
      else if (merged.source_platform === 'google_meet') platforms.add('google_meet');
    });
  }

  // No platforms to show
  if (platforms.size === 0) return null;

  // Order: Fathom first, then Zoom, then Google Meet
  const orderedPlatforms: SourcePlatform[] = [];
  if (platforms.has('fathom')) orderedPlatforms.push('fathom');
  if (platforms.has('zoom')) orderedPlatforms.push('zoom');
  if (platforms.has('google_meet')) orderedPlatforms.push('google_meet');

  // Build tooltip content
  const platformNames: Record<SourcePlatform, string> = {
    fathom: 'Fathom',
    zoom: 'Zoom',
    google_meet: 'Google Meet',
  };

  const tooltipText = orderedPlatforms.length === 1
    ? `Synced from ${platformNames[orderedPlatforms[0]]}`
    : `Synced from ${orderedPlatforms.map(p => platformNames[p]).join(', ')}`;

  // Calculate overlap: show 60% of each subsequent icon
  const overlap = size * 0.4;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center shrink-0"
            style={{
              width: orderedPlatforms.length === 1
                ? size
                : size + (orderedPlatforms.length - 1) * (size - overlap)
            }}
          >
            {orderedPlatforms.map((platform, index) => {
              const Icon = platform === 'fathom'
                ? FathomIcon
                : platform === 'zoom'
                  ? ZoomIcon
                  : GoogleMeetIcon;

              return (
                <div
                  key={platform}
                  className="rounded-full shadow-sm"
                  style={{
                    marginLeft: index === 0 ? 0 : -overlap,
                    zIndex: orderedPlatforms.length - index, // First icon on top
                  }}
                >
                  <Icon size={size} />
                </div>
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
