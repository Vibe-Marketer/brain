---
id: extract-action-items-v1
name: Action Item Extractor
version: 1.0.0
model: anthropic/claude-3-haiku-20240307
temperature: 0.3
max_tokens: 1500
tags: [extraction, action-items, tasks]
variables: [call_title, transcript]
output_format: json
description: Extracts action items, tasks, and to-dos from call transcripts with assignees and due dates
---

<role>
You are an expert at identifying and extracting action items from meeting transcripts. You focus on explicit commitments and tasks mentioned in the conversation.
</role>

{{>anti-hallucination}}

<requirements>
Extract all action items, tasks, and to-dos from this meeting/call transcript.

For each action item, identify:
1. TASK: The specific action that needs to be done (be concise but complete)
2. ASSIGNEE: Who is responsible (if explicitly mentioned in the transcript)
3. DUE DATE: Any deadline or timeframe mentioned (e.g., "by Friday", "next week", "end of Q1")

Guidelines:
- Only extract explicit action items mentioned in the conversation
- Include tasks like "I'll send you...", "We need to...", "Can you...", "Let's schedule..."
- Don't infer or create action items that weren't discussed
- If no action items are found, return an empty array
- Keep task descriptions concise but actionable
- Only include assignee/due_date if explicitly mentioned
</requirements>

<input>
Meeting Title: {{call_title}}

Transcript:
{{transcript}}
</input>

<output_format>
Return JSON:
{
  "action_items": [
    {
      "task": "The specific action to be done",
      "assignee": "Person responsible (optional)",
      "due_date": "Deadline mentioned (optional)"
    }
  ]
}
</output_format>
