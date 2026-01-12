/**
 * Content Hub Overview Page
 *
 * Landing page for the Content Hub section.
 * Shows stats and quick links to generators and libraries.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RiSparklingLine,
  RiLightbulbLine,
  RiFileTextLine,
  RiMailLine,
  RiArrowRightLine,
} from '@remixicon/react';
import { useBusinessProfileStore, useProfiles } from '@/stores/businessProfileStore';
import { useHooksLibraryStore, useHooks } from '@/stores/hooksLibraryStore';
import { useContentItemsStore, usePosts, useEmails } from '@/stores/contentItemsStore';

export default function ContentHub() {
  const fetchProfiles = useBusinessProfileStore((state) => state.fetchProfiles);
  const fetchHooks = useHooksLibraryStore((state) => state.fetchHooks);
  const fetchPosts = useContentItemsStore((state) => state.fetchPosts);
  const fetchEmails = useContentItemsStore((state) => state.fetchEmails);

  const profiles = useProfiles();
  const hooks = useHooks();
  const posts = usePosts();
  const emails = useEmails();

  useEffect(() => {
    fetchProfiles();
    fetchHooks();
    fetchPosts();
    fetchEmails();
  }, [fetchProfiles, fetchHooks, fetchPosts, fetchEmails]);

  const hasProfiles = profiles.length > 0;

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-wide font-montserrat">
          Content Hub
        </h1>
        <p className="text-muted-foreground mt-1">
          Transform your call transcripts into ready-to-use marketing content
        </p>
      </div>

      {/* Setup Banner - Show if no profiles */}
      {!hasProfiles && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <RiLightbulbLine className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                Set Up Your Business Profile
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Create a business profile to personalize your AI-generated content.
              </p>
              <Link
                to="/settings/business-profile"
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline mt-2"
              >
                Create Profile <RiArrowRightLine className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <RiLightbulbLine className="w-5 h-5 text-cb-vibe-orange" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{hooks.length}</p>
              <p className="text-sm text-muted-foreground">Hooks</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <RiFileTextLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{posts.length}</p>
              <p className="text-sm text-muted-foreground">Posts</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <RiMailLine className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{emails.length}</p>
              <p className="text-sm text-muted-foreground">Emails</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generators Card */}
        <Link
          to="/content/generators"
          className="group bg-card border rounded-lg p-6 hover:border-cb-vibe-orange/50 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-lg">
              <RiSparklingLine className="w-6 h-6 text-cb-vibe-orange" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-cb-vibe-orange transition-colors">
                Content Generators
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create hooks, posts, and emails from your call transcripts
              </p>
            </div>
            <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-cb-vibe-orange transition-colors" />
          </div>
        </Link>

        {/* Libraries Card */}
        <Link
          to="/content/library/hooks"
          className="group bg-card border rounded-lg p-6 hover:border-cb-vibe-orange/50 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-lg">
              <RiFileTextLine className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-cb-vibe-orange transition-colors">
                Content Libraries
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Browse and manage your generated hooks, posts, and emails
              </p>
            </div>
            <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-cb-vibe-orange transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
