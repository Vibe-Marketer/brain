/**
 * Content Generators Page
 *
 * Shows available content generators as cards.
 * Currently only Social Post Generator is available.
 *
 * Uses the 3-pane architecture:
 * - Pane 1: Navigation rail (via AppShell)
 * - Pane 2: ContentCategoryPane for content navigation
 * - Pane 3: Main content (this component's content)
 */

import { Link } from 'react-router-dom';
import {
  RiPhoneLine,
  RiArrowRightLine,
  RiTimeLine,
  RiSparklingLine,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { ContentCategoryPane } from '@/components/panes/ContentCategoryPane';

interface GeneratorCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  available: boolean;
}

const generators: GeneratorCard[] = [
  {
    id: 'call-content',
    title: 'Social Post Generator',
    description: 'Transform call transcripts into viral hooks, social posts, and email drafts using AI.',
    icon: <RiPhoneLine className="w-6 h-6" />,
    path: '/content/generators/call-content',
    available: true,
  },
  {
    id: 'coming-soon-1',
    title: 'Document Content Generator',
    description: 'Generate content from PDFs, docs, and notes. Coming soon.',
    icon: <RiTimeLine className="w-6 h-6" />,
    path: '#',
    available: false,
  },
  {
    id: 'coming-soon-2',
    title: 'Video Content Generator',
    description: 'Extract insights and content from video recordings. Coming soon.',
    icon: <RiTimeLine className="w-6 h-6" />,
    path: '#',
    available: false,
  },
];

export default function ContentGenerators() {
  return (
    <AppShell
      config={{
        secondaryPane: <ContentCategoryPane />,
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
              <RiSparklingLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                Generators
              </h2>
              <p className="text-xs text-ink-muted">
                Create new content
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Generator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {generators.map((generator) => (
          <GeneratorCardComponent key={generator.id} generator={generator} />
        ))}
        </div>
        </div>
      </div>
    </AppShell>
  );
}

function GeneratorCardComponent({ generator }: { generator: GeneratorCard }) {
  if (!generator.available) {
    return (
      <div className="bg-card border rounded-lg p-6 opacity-60">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-muted-foreground">
            {generator.icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-muted-foreground">
              {generator.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {generator.description}
            </p>
            <span className="inline-block mt-3 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={generator.path}
      className="group bg-card border rounded-lg p-6 hover:border-vibe-orange/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-lg text-vibe-orange">
          {generator.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold group-hover:text-vibe-orange transition-colors">
            {generator.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {generator.description}
          </p>
        </div>
        <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-vibe-orange transition-colors" />
      </div>
    </Link>
  );
}
