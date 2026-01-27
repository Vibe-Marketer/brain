/**
 * Content Builder (Agent 4)
 *
 * Creates social posts and emails from hooks using SSE streaming.
 * Generates content personalized to the user's business profile.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

interface ContentBuilderRequest {
  hook_ids: string[];
  business_profile?: BusinessProfileContext;
  model?: string;
}

interface BusinessProfileContext {
  avatar: string;
  target_audience: string;
  offer_name: string;
  offer_promise: string;
  price_point: string;
  brand_voice: string;
  prohibited_terms: string;
}

async function* streamContentGeneration(
  hook: { id: string; hook_text: string; topic_hint: string | null },
  businessContext: BusinessProfileContext | null,
  apiKey: string,
  model: string
): AsyncGenerator<{ type: string; hook_id: string; field?: string; delta?: string; data?: unknown }> {
  const contextSection = businessContext
    ? `
BUSINESS CONTEXT:
- Target Audience: ${businessContext.target_audience || 'General business audience'}
- Offer: ${businessContext.offer_name || 'Business solution'}
- Value Promise: ${businessContext.offer_promise || 'Help solve problems'}
- Brand Voice: ${businessContext.brand_voice || 'Professional but approachable'}
- Avoid: ${businessContext.prohibited_terms || 'None specified'}
`
    : '';

  const systemPrompt = `You are an expert content writer creating engaging social posts and emails from hooks.

Your job is to expand hooks into full content pieces that:
1. Hook attention (the hook is already provided)
2. Build value and context
3. Create connection with the reader
4. End with a soft call-to-action or thought-provoker
${contextSection}
CONTENT REQUIREMENTS:

**Social Post** (LinkedIn/Twitter style):
- 150-300 words max
- Start with the hook
- Add 2-3 supporting points or story elements
- Use short paragraphs (1-2 sentences)
- End with a question or call-to-action
- Include 2-3 relevant hashtags

**Email** (Outreach style):
- Subject line: Curiosity-driven, 5-8 words
- Body: 100-150 words
- Personal tone (like messaging a colleague)
- Reference the hook concept naturally
- End with a soft ask (e.g., "worth a chat?")

Generate content for this hook and return valid JSON:
{
  "social_post_text": "The full social post...",
  "email_subject": "Subject line here",
  "email_body_opening": "The email body..."
}`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault Content Builder',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create content for this hook:\n\nHook: "${hook.hook_text}"\nTopic: ${hook.topic_hint || 'General business'}`,
        },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  yield { type: 'start', hook_id: hook.id };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          // Stream content as it comes in
          yield { type: 'delta', hook_id: hook.id, delta };
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Parse the final JSON
  try {
    // Extract JSON from the content (it might have markdown or extra text)
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      yield {
        type: 'complete',
        hook_id: hook.id,
        data: {
          social_post_text: parsed.social_post_text || '',
          email_subject: parsed.email_subject || '',
          email_body_opening: parsed.email_body_opening || '',
        },
      };
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (error) {
    yield {
      type: 'error',
      hook_id: hook.id,
      data: { error: error instanceof Error ? error.message : 'Failed to parse content' },
    };
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: ContentBuilderRequest = await req.json();
    const { hook_ids, business_profile, model = DEFAULT_MODEL } = body;

    if (!hook_ids || hook_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'hook_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get hooks
    const { data: hooks, error: hooksError } = await supabase
      .from('hooks')
      .select('id, hook_text, topic_hint')
      .in('id', hook_ids)
      .eq('user_id', user.id);

    if (hooksError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch hooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hooks || hooks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hooks found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup SSE streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Process each hook
          for (const hook of hooks) {
            for await (const event of streamContentGeneration(
              hook,
              business_profile || null,
              openrouterApiKey,
              model
            )) {
              send(event);

              // On complete, save to database
              if (event.type === 'complete' && event.data) {
                const content = event.data as { social_post_text: string; email_subject: string; email_body_opening: string };

                // Save social post
                await supabase.from('content_items').insert({
                  user_id: user.id,
                  hook_id: hook.id,
                  content_type: 'post',
                  content_text: content.social_post_text,
                  status: 'draft',
                });

                // Save email
                await supabase.from('content_items').insert({
                  user_id: user.id,
                  hook_id: hook.id,
                  content_type: 'email',
                  content_text: content.email_body_opening,
                  email_subject: content.email_subject,
                  status: 'draft',
                });

                // Mark hook as selected (content created)
                await supabase
                  .from('hooks')
                  .update({ status: 'selected' })
                  .eq('id', hook.id);
              }
            }
          }

          send({ type: 'done' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Stream error:', error);
          send({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in content-builder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
