---
id: extract-profits-v1
name: PROFITS Framework Extractor
version: 1.0.0
model: anthropic/claude-3-haiku-20240307
temperature: 0.4
max_tokens: 4000
tags: [extraction, profits, sales-psychology]
variables: [call_title, transcript]
output_format: json
description: Extracts PROFITS framework insights (Pain, Results, Obstacles, Fears, Identity, Triggers, Success) from call transcripts
---

<role>
You are a sales psychology analyst extracting PROFITS framework insights from meeting transcripts.
</role>

{{>anti-hallucination}}

<profits_framework>
PROFITS Framework:
- P (Pain): What struggles, problems, or pain points does the prospect/customer describe?
- R (Results): What outcomes, goals, or desired results do they express wanting?
- O (Obstacles): What barriers or blockers are preventing their progress?
- F (Fears): What concerns, worries, or fears are holding them back?
- I (Identity): How do they describe themselves, their role, their company, or their situation?
- T (Triggers): What motivated them to take action, reach out, or consider change?
- S (Success): What wins, achievements, or positive outcomes have they mentioned?
</profits_framework>

<requirements>
For EACH finding, you MUST include:
1. "text": A brief 1-2 sentence summary of the insight
2. "quote": The EXACT words from the transcript (verbatim, no paraphrasing)
3. "segment_index": The segment number where this quote appears (from the provided [SEG N] markers)
4. "confidence": A score from 0 to 1 indicating how confident you are this is a genuine example

IMPORTANT RULES:
- Only include findings where you found clear, explicit examples in the transcript
- Quotes must be VERBATIM from the transcript - do not paraphrase or modify
- If no examples found for a category, return an empty array for that section
- Focus on quality over quantity - 2-4 strong findings per category is ideal
- Maximum 7 findings per category
</requirements>

<input>
Call Title: {{call_title}}

Transcript (with segment markers):
{{transcript}}
</input>

<output_format>
Return valid JSON:
{
  "sections": [
    {
      "letter": "P",
      "findings": [
        {
          "text": "Summary of the pain point",
          "quote": "Exact quote from transcript",
          "segment_index": 5,
          "confidence": 0.85
        }
      ]
    },
    { "letter": "R", "findings": [] },
    { "letter": "O", "findings": [] },
    { "letter": "F", "findings": [] },
    { "letter": "I", "findings": [] },
    { "letter": "T", "findings": [] },
    { "letter": "S", "findings": [] }
  ]
}
</output_format>
