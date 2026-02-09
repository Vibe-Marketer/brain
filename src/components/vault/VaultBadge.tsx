/**
 * VaultBadge - Single vault badge component
 *
 * Displays a clickable badge showing vault name with type-specific styling.
 * Personal vaults use subtle styling; team/coach/client vaults are prominent.
 * Clicking navigates to /vaults/:vaultId.
 *
 * @brand-version v4.2
 */

import { useNavigate } from 'react-router-dom'
import { RiUserLine, RiSafeLine } from '@remixicon/react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { VaultType } from '@/types/bank'

export interface VaultBadgeProps {
  /** UUID of the vault */
  vaultId: string
  /** Display name of the vault */
  vaultName: string
  /** Type of vault - affects styling */
  vaultType: VaultType
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Custom click handler (overrides default navigation) */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

const sizeStyles = {
  sm: 'h-6 text-xs px-1.5 gap-1',
  md: 'h-7 text-sm px-2 gap-1.5',
  lg: 'h-8 text-sm px-2.5 gap-1.5',
} as const

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
} as const

/**
 * VaultBadge - Renders a clickable vault badge
 */
export function VaultBadge({
  vaultId,
  vaultName,
  vaultType,
  size = 'md',
  onClick,
  className,
}: VaultBadgeProps) {
  const navigate = useNavigate()
  const isPersonal = vaultType === 'personal'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    } else {
      navigate(`/vaults/${vaultId}`)
    }
  }

  const badge = (
    <button
      onClick={handleClick}
      className={cn(
        // Base styles
        'inline-flex items-center rounded-md font-inter font-medium transition-colors',
        'max-w-[140px] cursor-pointer',
        // Size
        sizeStyles[size],
        // Personal vault: subtle
        isPersonal && [
          'bg-muted text-muted-foreground',
          'hover:bg-muted/80',
        ],
        // Team/Coach/Client/Community: prominent
        !isPersonal && [
          'bg-card border border-border text-foreground',
          'hover:border-vibe-orange/50 hover:bg-accent',
        ],
        className,
      )}
    >
      {isPersonal ? (
        <RiUserLine className={cn('flex-shrink-0', iconSizes[size])} />
      ) : (
        <RiSafeLine className={cn('flex-shrink-0', iconSizes[size])} />
      )}
      <span className="truncate">{vaultName}</span>
    </button>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{vaultName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
