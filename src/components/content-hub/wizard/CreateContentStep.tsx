/**
 * Create Content Step
 *
 * Step 4 of the Social Post Generator wizard.
 * Generates content for each selected hook using Agent 4 (streaming).
 * Shows real-time streaming output and allows editing/saving.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  RiSparklingLine,
  RiLoader4Line,
  RiCheckLine,
  RiFileCopyLine,
  RiEdit2Line,
  RiCloseLine,
  RiFileTextLine,
  RiMailLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  useContentWizardStore,
  useContentStatus,
  useGeneratedHooks,
  useSelectedHooks,
} from '@/stores/contentWizardStore';
import type { Hook, StreamingContent } from '@/types/content-hub';

interface HookContentCardProps {
  hook: Hook;
  content: StreamingContent | undefined;
  onCopy: (type: 'post' | 'email') => void;
}

function HookContentCard({ hook, content, onCopy }: HookContentCardProps) {
  const [editingPost, setEditingPost] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [postText, setPostText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const updateStreamingContent = useContentWizardStore((state) => state.appendStreamingContent);

  // Update local state when content changes
  useEffect(() => {
    if (content) {
      setPostText(content.social_post_text);
      setEmailSubject(content.email_subject);
      setEmailBody(content.email_body_opening);
    }
  }, [content]);

  const handleSavePost = () => {
    // In production, this would update the database
    setEditingPost(false);
  };

  const handleSaveEmail = () => {
    // In production, this would update the database
    setEditingEmail(false);
  };

  const isStreaming = content?.is_streaming ?? false;
  const hasContent = content && (content.social_post_text || content.email_subject);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Hook Header */}
      <div className="bg-muted/50 px-4 py-3 border-b">
        <p className="font-medium line-clamp-1">{hook.hook_text}</p>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="post" className="w-full">
        <TabsList>
          <TabsTrigger value="post">
            <RiFileTextLine className="w-4 h-4 mr-2" />
            SOCIAL POST
          </TabsTrigger>
          <TabsTrigger value="email">
            <RiMailLine className="w-4 h-4 mr-2" />
            EMAIL
          </TabsTrigger>
        </TabsList>

        {/* Social Post */}
        <TabsContent value="post" className="p-4 mt-0">
          {!hasContent ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {isStreaming ? (
                <>
                  <RiLoader4Line className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Content will appear here'
              )}
            </div>
          ) : editingPost ? (
            <div className="space-y-3">
              <Textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="min-h-[150px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingPost(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSavePost}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <p className="whitespace-pre-wrap">{content?.social_post_text}</p>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-vibe-orange animate-pulse ml-1" />
                )}
              </div>
              {!isStreaming && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onCopy('post')}>
                    <RiFileCopyLine className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingPost(true)}>
                    <RiEdit2Line className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className="p-4 mt-0">
          {!hasContent ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {isStreaming ? (
                <>
                  <RiLoader4Line className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Content will appear here'
              )}
            </div>
          ) : editingEmail ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Body</label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="mt-1 min-h-[150px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingEmail(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEmail}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                <p className="font-medium">{content?.email_subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Body:</p>
                <p className="whitespace-pre-wrap">{content?.email_body_opening}</p>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-vibe-orange animate-pulse ml-1" />
                )}
              </div>
              {!isStreaming && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onCopy('email')}>
                    <RiFileCopyLine className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingEmail(true)}>
                    <RiEdit2Line className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CreateContentStep() {
  const { toast } = useToast();

  const contentStatus = useContentStatus();
  const generatedHooks = useGeneratedHooks();
  const selectedHookIds = useSelectedHooks();

  const setContentStatus = useContentWizardStore((state) => state.setContentStatus);
  const initStreamingContent = useContentWizardStore((state) => state.initStreamingContent);
  const appendStreamingContent = useContentWizardStore((state) => state.appendStreamingContent);
  const finalizeStreamingContent = useContentWizardStore((state) => state.finalizeStreamingContent);
  const generatedContent = useContentWizardStore((state) => state.generated_content);

  const [currentHookIndex, setCurrentHookIndex] = useState(0);

  const selectedHooks = generatedHooks.filter((hook) => selectedHookIds.includes(hook.id));

  // Auto-start content generation
  useEffect(() => {
    if (contentStatus === 'idle' && selectedHooks.length > 0) {
      generateContent();
    }
  }, [contentStatus, selectedHooks.length]);

  const generateContent = async () => {
    setContentStatus('running');

    for (let i = 0; i < selectedHooks.length; i++) {
      const hook = selectedHooks[i];
      setCurrentHookIndex(i);
      initStreamingContent(hook.id);

      // Simulate streaming - in production, this would be an SSE connection
      const postContent = `Here's the truth about ${hook.topic_hint || 'productivity'}...

${hook.hook_text}

Most people don't realize this, but the biggest barrier isn't technology - it's mindset.

When I talked to a client last week, they said something that stuck with me: "We spent 5 years doing this manually because we were afraid of change."

Here's what I told them:

1. Start small - automate one process first
2. Measure the results
3. Let the data speak for itself

The results? 40 hours saved per week. Zero errors.

What's holding you back from making the switch?

#productivity #automation #business`;

      const emailSubject = `Quick question about ${hook.topic_hint || 'your workflow'}`;
      const emailBody = `Hey {{firstName}},

I was thinking about our conversation the other day, and something you said really stuck with me:

"${hook.hook_text.substring(0, 100)}..."

I've been working with a few other teams facing the exact same challenge, and I wanted to share what's been working for them.

Would you have 15 minutes this week to chat about it?`;

      // Simulate streaming character by character
      for (let j = 0; j < postContent.length; j += 5) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        appendStreamingContent(hook.id, 'social_post_text', postContent.substring(j, j + 5));
      }

      for (let j = 0; j < emailSubject.length; j += 3) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        appendStreamingContent(hook.id, 'email_subject', emailSubject.substring(j, j + 3));
      }

      for (let j = 0; j < emailBody.length; j += 5) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        appendStreamingContent(hook.id, 'email_body_opening', emailBody.substring(j, j + 5));
      }

      finalizeStreamingContent(hook.id);
    }

    setContentStatus('completed');
  };

  const handleCopy = useCallback(async (hookId: string, type: 'post' | 'email') => {
    const content = generatedContent[hookId];
    if (!content) return;

    const text = type === 'post'
      ? content.social_post_text
      : `Subject: ${content.email_subject}\n\n${content.email_body_opening}`;

    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: `${type === 'post' ? 'Post' : 'Email'} content has been copied.`,
    });
  }, [generatedContent, toast]);

  const isComplete = contentStatus === 'completed';
  const progress = selectedHooks.length > 0
    ? Math.round(((currentHookIndex + (isComplete ? 1 : 0)) / selectedHooks.length) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Creating Your Content</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generating posts and emails for {selectedHooks.length} hook{selectedHooks.length !== 1 ? 's' : ''}.
          </p>
        </div>

        {/* Progress */}
        {!isComplete && (
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-vibe-orange transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {currentHookIndex + 1}/{selectedHooks.length}
            </span>
          </div>
        )}

        {isComplete && (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <RiCheckLine className="w-5 h-5" />
            <span className="font-medium">Complete!</span>
          </div>
        )}
      </div>

      {/* Content Cards */}
      <div className="space-y-4">
        {selectedHooks.map((hook, index) => (
          <HookContentCard
            key={hook.id}
            hook={hook}
            content={generatedContent[hook.id]}
            onCopy={(type) => handleCopy(hook.id, type)}
          />
        ))}
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <RiCheckLine className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                Content generated successfully!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Your posts and emails have been saved to the library. Click "Done" to finish.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
