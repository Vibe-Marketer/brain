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

/**
 * YouTube icon - red circle with white play button
 */
export function YouTubeIcon({ className, size }: IconProps) {
  const computedSize = size ?? getSizeFromClassName(className) ?? 16;
  return (
    <svg
      width={computedSize}
      height={computedSize}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red circular background */}
      <circle cx="50" cy="50" r="50" fill="#FF0000" />
      {/* White play triangle */}
      <polygon points="40,30 40,70 72,50" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Upload/File icon - gray circle with white up-arrow
 */
export function UploadIcon({ className, size }: IconProps) {
  const computedSize = size ?? getSizeFromClassName(className) ?? 16;
  return (
    <svg
      width={computedSize}
      height={computedSize}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gray circular background */}
      <circle cx="50" cy="50" r="50" fill="#6B7280" />
      {/* White up-arrow */}
      <path d="M50 25L30 50H43V70H57V50H70L50 25Z" fill="#FFFFFF" />
    </svg>
  );
}

type SourcePlatform = 'fathom' | 'zoom';

interface SourcePlatformIndicatorProps {
  /** Primary source platform */
  sourcePlatform?: string | null;
  /** Array of merged source platforms (for merged meetings) */
  mergedFrom?: Array<{ source_platform?: string } | number> | null;
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

  // Add merged platforms
  if (mergedFrom && mergedFrom.length > 0) {
    mergedFrom.forEach(merged => {
      // Skip numeric IDs, we only want objects with platform info
      if (typeof merged === 'number') return;
      
      if (merged.source_platform === 'fathom') platforms.add('fathom');
      else if (merged.source_platform === 'zoom') platforms.add('zoom');
    });
  }

  // No platforms to show
  if (platforms.size === 0) return null;

  // Order: Fathom first, then Zoom
  const orderedPlatforms: SourcePlatform[] = [];
  if (platforms.has('fathom')) orderedPlatforms.push('fathom');
  if (platforms.has('zoom')) orderedPlatforms.push('zoom');

  // Build tooltip content
  const platformNames: Record<SourcePlatform, string> = {
    fathom: 'Fathom',
    zoom: 'Zoom',
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
                : ZoomIcon;

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
