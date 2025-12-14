/**
 * WorkspaceCard Component
 * 
 * Visual card for displaying workspaces in grid layout
 * Features:
 * - Gradient hero image
 * - Workspace emoji/icon
 * - Title and metadata
 * - Member avatars
 * - Hover effects
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface WorkspaceCardProps {
  id: string;
  title: string;
  emoji: string;
  memberCount: number;
  callCount: number;
  members: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  lastUpdated: Date;
  gradient: string;
  path: string;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  id,
  title,
  emoji,
  memberCount,
  callCount,
  members,
  lastUpdated,
  gradient,
  path,
}) => {
  const displayMembers = members.slice(0, 3);
  const remainingMembers = memberCount - displayMembers.length;

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Link
      to={path}
      className={cn(
        "group block bg-white dark:bg-gray-900 rounded-xl overflow-hidden",
        "border border-gray-200 dark:border-gray-800",
        "shadow-sm hover:shadow-lg transition-all duration-300",
        "hover:-translate-y-1"
      )}
    >
      {/* Hero Image with Gradient */}
      <div 
        className="relative h-[120px] overflow-hidden"
        style={{ background: gradient }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        
        {/* Workspace Emoji - Overlapping */}
        <div className="absolute -bottom-6 left-4">
          <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-xl shadow-lg flex items-center justify-center text-2xl border-2 border-white dark:border-gray-800">
            {emoji}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-8">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {title}
        </h3>

        {/* Metadata */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {memberCount} {memberCount === 1 ? 'member' : 'members'} • {callCount} {callCount === 1 ? 'call' : 'calls'}
        </p>

        {/* Members */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-2">
            {displayMembers.map((member) => (
              <Avatar key={member.id} className="w-8 h-8 border-2 border-white dark:border-gray-900">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback className="bg-purple-600 text-white text-xs">
                  {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {remainingMembers > 0 && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              +{remainingMembers}
            </span>
          )}
        </div>

        {/* Last Updated */}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last updated {formatLastUpdated(lastUpdated)}
        </p>
      </div>
    </Link>
  );
};

// Predefined gradient options
export const WORKSPACE_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
];
