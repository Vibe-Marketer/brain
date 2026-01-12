/**
 * Content Generators Page
 *
 * Shows available content generators as cards.
 * Currently only Call Content Generator is available.
 */

import { Link } from 'react-router-dom';
import {
  RiPhoneLine,
  RiArrowRightLine,
  RiTimeLine,
} from '@remixicon/react';

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
    title: 'Call Content Generator',
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
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-wide font-montserrat">
          Content Generators
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose a generator to create content from your sources
        </p>
      </div>

      {/* Generator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {generators.map((generator) => (
          <GeneratorCardComponent key={generator.id} generator={generator} />
        ))}
      </div>
    </div>
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
      className="group bg-card border rounded-lg p-6 hover:border-cb-vibe-orange/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 rounded-lg text-cb-vibe-orange">
          {generator.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold group-hover:text-cb-vibe-orange transition-colors">
            {generator.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {generator.description}
          </p>
        </div>
        <RiArrowRightLine className="w-5 h-5 text-muted-foreground group-hover:text-cb-vibe-orange transition-colors" />
      </div>
    </Link>
  );
}
