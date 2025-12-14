/**
 * ContentGenerator Component
 * 
 * Modal/panel for generating content from insights
 * Supports: emails, social posts, blog outlines, case studies
 */

import React, { useState } from 'react';
import { 
  RiMailLine, 
  RiTwitterXLine, 
  RiArticleLine, 
  RiFileTextLine,
  RiSparklingLine,
  RiCloseLine,
  RiFileCopyLine,
  RiDownloadLine
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAIProcessing } from '@/hooks/useAIProcessing';
import { type ExtractedInsight } from '@/lib/ai-agent';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ContentType = 'email' | 'social-post' | 'blog-outline' | 'case-study';
type Tone = 'professional' | 'casual' | 'friendly';

interface ContentGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insights: ExtractedInsight[];
}

const CONTENT_TYPES = [
  {
    value: 'email' as ContentType,
    label: 'Follow-up Email',
    icon: RiMailLine,
    description: 'Professional email referencing the conversation',
  },
  {
    value: 'social-post' as ContentType,
    label: 'Social Media Post',
    icon: RiTwitterXLine,
    description: 'Engaging LinkedIn-style post',
  },
  {
    value: 'blog-outline' as ContentType,
    label: 'Blog Outline',
    icon: RiArticleLine,
    description: 'Detailed blog post structure',
  },
  {
    value: 'case-study' as ContentType,
    label: 'Case Study',
    icon: RiFileTextLine,
    description: 'Problem-solution-results format',
  },
];

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({
  open,
  onOpenChange,
  insights,
}) => {
  const [contentType, setContentType] = useState<ContentType>('email');
  const [tone, setTone] = useState<Tone>('professional');
  const [targetAudience, setTargetAudience] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');

  const { createContent, isProcessing } = useAIProcessing();

  const handleGenerate = async () => {
    if (insights.length === 0) {
      toast.error('No insights selected');
      return;
    }

    try {
      const stream = await createContent(contentType, insights, {
        tone,
        targetAudience: targetAudience || undefined,
        additionalContext: additionalContext || undefined,
      });

      // Handle streaming response
      let content = '';
      for await (const chunk of stream.textStream) {
        content += chunk;
        setGeneratedContent(content);
      }

      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contentType}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const selectedType = CONTENT_TYPES.find(t => t.value === contentType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiSparklingLine className="w-5 h-5 text-purple-600" />
            Generate Content from Insights
          </DialogTitle>
          <DialogDescription>
            Create marketing content based on {insights.length} selected insight{insights.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Type Selection */}
          <div>
            <Label className="mb-3 block">Content Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setContentType(type.value)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left",
                      contentType === type.value
                        ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5 flex-shrink-0 mt-0.5",
                      contentType === type.value
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-gray-600 dark:text-gray-400"
                    )} />
                    <div>
                      <h4 className={cn(
                        "font-semibold text-sm mb-1",
                        contentType === type.value
                          ? "text-purple-900 dark:text-purple-100"
                          : "text-gray-900 dark:text-white"
                      )}>
                        {type.label}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {type.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="audience">Target Audience (Optional)</Label>
              <input
                id="audience"
                type="text"
                placeholder="e.g., Marketing managers"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {/* Additional Context */}
          <div>
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              placeholder="Add any specific details, requirements, or context..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isProcessing ? (
              <>
                <RiSparklingLine className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RiSparklingLine className="w-5 h-5 mr-2" />
                Generate {selectedType?.label}
              </>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <Label>Generated Content</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    size="sm"
                  >
                    <RiFileCopyLine className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    size="sm"
                  >
                    <RiDownloadLine className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 dark:text-white">
                  {generatedContent}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
