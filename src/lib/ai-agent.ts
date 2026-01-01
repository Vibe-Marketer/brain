/**
 * AI Agent Service
 * 
 * Handles all AI-powered knowledge extraction and content generation
 * Uses Vercel AI SDK for streaming and agent orchestration
 */

import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Initialize OpenAI client (uses env vars automatically)
const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
});

export interface PROFITSInsights {
  pain: string[];
  results: string[];
  obstacles: string[];
  fears: string[];
  identity: string[];
  triggers: string[];
  success: string[];
}

export interface ExtractedInsight {
  type: 'pain' | 'success' | 'objection' | 'question';
  content: string;
  confidence: number;
  context: string;
  tags: string[];
}

export interface CallAnalysis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  keyTopics: string[];
  participants: string[];
  actionItems: string[];
  insights: ExtractedInsight[];
  profitsFramework: PROFITSInsights;
  quotes: Array<{
    text: string;
    speaker: string;
    timestamp?: string;
    significance: number;
  }>;
}

/**
 * Extract knowledge from a call transcript using AI
 */
export async function extractKnowledgeFromTranscript(
  transcript: string,
  metadata?: {
    title?: string;
    participants?: string[];
    date?: Date;
  }
): Promise<CallAnalysis> {
  const systemPrompt = `You are an expert AI analyst specializing in extracting actionable insights from business conversations.

Your task is to analyze call transcripts and extract:
1. PROFITS Framework elements (Pain, Results, Obstacles, Fears, Identity, Triggers, Success)
2. Key insights categorized as: pain points, success stories, objections, questions
3. Sentiment analysis
4. Action items
5. Notable quotes
6. Key topics

Be thorough, accurate, and provide confidence scores for insights.`;

  const userPrompt = `Analyze this call transcript and extract all valuable insights:

${metadata?.title ? `Call Title: ${metadata.title}` : ''}
${metadata?.participants ? `Participants: ${metadata.participants.join(', ')}` : ''}
${metadata?.date ? `Date: ${metadata.date.toISOString()}` : ''}

Transcript:
${transcript}

Provide a comprehensive analysis in JSON format with the following structure:
{
  "summary": "Brief summary of the call",
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0-100,
  "keyTopics": ["topic1", "topic2"],
  "participants": ["name1", "name2"],
  "actionItems": ["action1", "action2"],
  "insights": [
    {
      "type": "pain|success|objection|question",
      "content": "The actual insight text",
      "confidence": 0-100,
      "context": "Surrounding context",
      "tags": ["tag1", "tag2"]
    }
  ],
  "profitsFramework": {
    "pain": ["pain point 1", "pain point 2"],
    "results": ["desired result 1"],
    "obstacles": ["obstacle 1"],
    "fears": ["fear 1"],
    "identity": ["identity statement 1"],
    "triggers": ["trigger 1"],
    "success": ["success story 1"]
  },
  "quotes": [
    {
      "text": "The quote",
      "speaker": "Speaker name",
      "timestamp": "optional timestamp",
      "significance": 0-100
    }
  ]
}`;

  try {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 4000,
    });

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const analysis: CallAnalysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error) {
    console.error('Error extracting knowledge:', error);
    throw new Error('Failed to analyze transcript');
  }
}

/**
 * Generate content from insights (streaming)
 */
export async function generateContent(
  type: 'email' | 'social-post' | 'blog-outline' | 'case-study',
  insights: ExtractedInsight[],
  context?: {
    tone?: 'professional' | 'casual' | 'friendly';
    targetAudience?: string;
    additionalContext?: string;
  }
) {
  const systemPrompt = `You are an expert content creator specializing in marketing and business communication.
Generate high-quality, engaging content based on insights from business conversations.`;

  const contentTypeInstructions = {
    'email': 'Create a professional follow-up email that references the conversation naturally and provides value.',
    'social-post': 'Create an engaging social media post (LinkedIn style) that shares insights or tells a story.',
    'blog-outline': 'Create a detailed blog post outline with sections, key points, and suggested content.',
    'case-study': 'Create a compelling case study structure highlighting the problem, solution, and results.',
  };

  const userPrompt = `Generate a ${type} based on these insights:

${insights.map((insight, i) => `${i + 1}. [${insight.type.toUpperCase()}] ${insight.content}`).join('\n')}

${context?.tone ? `Tone: ${context.tone}` : ''}
${context?.targetAudience ? `Target Audience: ${context.targetAudience}` : ''}
${context?.additionalContext ? `Additional Context: ${context.additionalContext}` : ''}

Instructions: ${contentTypeInstructions[type]}

Generate the content now:`;

  return streamText({
    model: openai('gpt-4-turbo'),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 2000,
  });
}

/**
 * Apply insights to a new call (real-time coaching)
 */
export async function applyInsightsToCall(
  currentTranscript: string,
  relevantInsights: ExtractedInsight[]
): Promise<{
  suggestions: string[];
  talkingPoints: string[];
  warnings: string[];
}> {
  const systemPrompt = `You are a real-time sales coach analyzing an ongoing conversation.
Based on past insights and the current conversation, provide actionable suggestions.`;

  const userPrompt = `Current conversation:
${currentTranscript}

Relevant past insights:
${relevantInsights.map((insight, i) => `${i + 1}. [${insight.type}] ${insight.content}`).join('\n')}

Provide:
1. Suggestions for how to proceed
2. Talking points to address
3. Warnings about potential objections or concerns

Format as JSON:
{
  "suggestions": ["suggestion 1", "suggestion 2"],
  "talkingPoints": ["point 1", "point 2"],
  "warnings": ["warning 1", "warning 2"]
}`;

  try {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error applying insights:', error);
    throw new Error('Failed to generate coaching suggestions');
  }
}

/**
 * Batch process multiple transcripts in the background
 */
export async function batchProcessTranscripts(
  transcripts: Array<{
    id: string;
    content: string;
    metadata?: any;
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, CallAnalysis>> {
  const results = new Map<string, CallAnalysis>();
  
  for (let i = 0; i < transcripts.length; i++) {
    const transcript = transcripts[i];
    
    try {
      const analysis = await extractKnowledgeFromTranscript(
        transcript.content,
        transcript.metadata
      );
      results.set(transcript.id, analysis);
      
      if (onProgress) {
        onProgress(i + 1, transcripts.length);
      }
    } catch (error) {
      console.error(`Failed to process transcript ${transcript.id}:`, error);
    }
  }
  
  return results;
}

/**
 * Find similar insights using semantic search
 * (Requires vector database integration)
 */
export async function findSimilarInsights(
  query: string,
  allInsights: ExtractedInsight[],
  limit: number = 5
): Promise<ExtractedInsight[]> {
  // TODO: Implement with vector embeddings
  // For now, use simple keyword matching
  const queryLower = query.toLowerCase();
  
  return allInsights
    .map(insight => ({
      insight,
      score: insight.content.toLowerCase().includes(queryLower) ? 1 : 0,
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.insight);
}

/**
 * Generate summary of multiple calls
 */
export async function generateCallsSummary(
  calls: Array<{
    title: string;
    date: Date;
    summary: string;
  }>
): Promise<string> {
  const systemPrompt = `You are an expert at synthesizing information from multiple business conversations.
Create a concise, insightful summary that highlights patterns, trends, and key takeaways.`;

  const userPrompt = `Summarize these calls:

${calls.map((call, i) => `${i + 1}. ${call.title} (${call.date.toLocaleDateString()})
${call.summary}`).join('\n\n')}

Provide a comprehensive summary highlighting:
- Common themes and patterns
- Key insights across all calls
- Notable trends
- Recommended actions`;

  try {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1500,
    });

    return text;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate calls summary');
  }
}
