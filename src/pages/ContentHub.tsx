/**
 * Content Hub Overview Page
 *
 * Landing page for the Content Hub section.
 * Shows stats and quick links to generators and libraries.
 *
 * Uses the 3-pane architecture:
 * - Pane 1: Navigation rail (via AppShell)
 * - Pane 2: ContentCategoryPane for content navigation
 * - Pane 3: Main content (this component's content)
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RiSparklingLine,
  RiLightbulbLine,
  RiFileTextLine,
  RiMailLine,
  RiArrowRightLine,
  RiHome4Line,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { ContentCategoryPane } from '@/components/panes/ContentCategoryPane';
import { ContentHubStatsSkeleton } from '@/components/content-library/ContentHubStatsSkeleton';
import { useBusinessProfileStore, useProfiles } from '@/stores/businessProfileStore';
import { useHooksLibraryStore, useHooks, useHooksLoading } from '@/stores/hooksLibraryStore';
import { useContentItemsStore, usePosts, useEmails, usePostsLoading } from '@/stores/contentItemsStore';
import { useBankContext } from '@/hooks/useBankContext';

export default function ContentHub() {
  const fetchProfiles = useBusinessProfileStore((state) => state.fetchProfiles);
  const fetchHooks = useHooksLibraryStore((state) => state.fetchHooks);
  const fetchPosts = useContentItemsStore((state) => state.fetchPosts);
  const fetchEmails = useContentItemsStore((state) => state.fetchEmails);
  const { activeBankId } = useBankContext();

  const profiles = useProfiles();
  const hooks = useHooks();
  const posts = usePosts();
  const emails = useEmails();
  const hooksLoading = useHooksLoading();
  const postsLoading = usePostsLoading();

  // Combined loading state for all content data
  const isContentLoading = hooksLoading || postsLoading;

  useEffect(() => {
    fetchProfiles();
    fetchHooks();
    fetchPosts(undefined, activeBankId);
    fetchEmails(undefined, activeBankId);
  }, [fetchProfiles, fetchHooks, fetchPosts, fetchEmails, activeBankId]);

  const hasProfiles = profiles.length > 0;

  // Category counts for the secondary pane
  const categoryCounts = {
    hooks: hooks.length,
    posts: posts.length,
    emails: emails.length,
  };

  return (
    <AppShell
      config={{
        secondaryPane: <ContentCategoryPane categoryCounts={categoryCounts} />,
      }}
    >
      <div className="flex flex-col h-full overflow-auto">
        {/* Header - standardized detail pane pattern */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiHome4Line className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                OVERVIEW
              </h2>
              <p className="text-xs text-ink-muted">
                Content Hub home
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">

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
      {isContentLoading ? (
        <ContentHubStatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <RiLightbulbLine className="w-5 h-5 text-vibe-orange" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{hooks.length}</p>
                <p className="text-sm text-muted-foreground">Hooks</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-bg rounded-lg">
                <RiFileTextLine className="w-5 h-5 text-info-text" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{posts.length}</p>
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-bg rounded-lg">
                <RiMailLine className="w-5 h-5 text-info-text" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{emails.length}</p>
                <p className="text-sm text-muted-foreground">Emails</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generators Card */}
        <Link
          to="/content/generators"
          className="group bg-card border rounded-lg p-6 hover:border-vibe-orange/50 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-lg">
              <RiSparklingLine className="w-6 h-6 text-vibe-orange" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-vibe-orange transition-colors">
                Content Generators
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create hooks, posts, and emails from your call transcripts
              </p>
            </div>
            <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-vibe-orange transition-colors" />
          </div>
        </Link>

        {/* Libraries Card */}
        <Link
          to="/content/library/hooks"
          className="group bg-card border rounded-lg p-6 hover:border-vibe-orange/50 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-info-bg rounded-lg">
              <RiFileTextLine className="w-6 h-6 text-info-text" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-vibe-orange transition-colors">
                Content Libraries
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Browse and manage your generated hooks, posts, and emails
              </p>
            </div>
            <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-vibe-orange transition-colors" />
          </div>
        </Link>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
