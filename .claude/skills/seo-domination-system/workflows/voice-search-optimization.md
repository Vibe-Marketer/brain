# Voice Search Optimization Workflow

<objective>
Optimize content for voice search queries (Alexa, Siri, Google Assistant). Output: Voice-optimized content sections and speakable schema implementation.
</objective>

<inputs_required>
- Target topic/niche
- Existing content URLs to optimize
- Common questions in your space
</inputs_required>

<process>

## Phase 1: Voice Query Research

**Voice search characteristics:**
- Longer queries (7+ words average)
- Conversational/natural language
- Question-based (who, what, when, where, why, how)
- Local intent common ("near me")
- Action-oriented ("call," "directions to," "buy")

**Research voice queries:**

```
Using AnswerThePublic (3/day free):
1. Enter your seed keyword
2. Export all question variations
3. Focus on: How, What, Why, Can, Does, Is

Using AlsoAsked (3/day free):
1. Enter main keyword
2. Map the PAA tree
3. Note conversational phrasing
```

**Voice query patterns by intent:**

| Intent | Query Pattern | Example |
|--------|---------------|---------|
| Informational | "What is..." "How do I..." | "What is the best CRM for coaches" |
| Navigational | "Where is..." "Find..." | "Where is the nearest coffee shop" |
| Transactional | "Buy..." "Order..." | "Order flowers for delivery" |
| Local | "...near me" "...in [city]" | "Plumbers near me open now" |

## Phase 2: Content Restructuring for Voice

**The "Voice-First" content format:**

```
┌─────────────────────────────────────┐
│ H2: [Exact Voice Query as Question] │
├─────────────────────────────────────┤
│ Direct Answer (1-2 sentences, <30   │
│ words, conversational tone)         │
├─────────────────────────────────────┤
│ Supporting Context (2-3 sentences)  │
├─────────────────────────────────────┤
│ Detailed Explanation (for readers)  │
└─────────────────────────────────────┘
```

**Example transformation:**

❌ **Before (written for reading):**
```
Email marketing remains one of the most effective digital marketing
channels, with studies showing an average ROI of $42 for every $1 spent.
Businesses should consider implementing automated sequences...
```

✅ **After (optimized for voice):**
```
## Is Email Marketing Still Effective?

Yes, email marketing is still highly effective. It generates an average
return of $42 for every dollar spent, making it one of the highest-ROI
marketing channels available.

This ROI comes from email's direct access to your audience without
algorithm interference. Unlike social media, you own your email list
and can reach subscribers consistently.

[Continue with detailed explanation...]
```

## Phase 3: Conversational Content Guidelines

**Voice-friendly writing rules:**

1. **Use natural language**
   - Write how people speak
   - Use contractions (it's, you're, don't)
   - Avoid jargon unless defining it

2. **Answer immediately**
   - First sentence = direct answer
   - No buildup or context before the answer
   - 29 words or fewer for the core answer

3. **Use first and second person**
   - "You can..." instead of "Users can..."
   - "I recommend..." instead of "It is recommended..."

4. **Keep sentences short**
   - 15-20 words average
   - One idea per sentence
   - Active voice

**Readability targets:**
- Flesch Reading Ease: 60+ (aim for 70+)
- Grade level: 8th grade or lower
- Sentence length: Under 20 words average

## Phase 4: Question Targeting Strategy

**Build content around these question types:**

| Question Type | Example | Optimization |
|---------------|---------|--------------|
| Definition | "What is X?" | 1-2 sentence definition |
| Process | "How do I X?" | Numbered steps |
| Comparison | "X vs Y?" | Brief differentiator |
| Recommendation | "What's the best X?" | Clear recommendation + why |
| Yes/No | "Can I X?" "Should I X?" | Start with Yes/No + context |

**Create a Question Bank:**

For each topic, document:
- 5 "What" questions
- 5 "How" questions
- 3 "Why" questions
- 3 "Can/Should" questions
- 2 "Best/Top" questions

## Phase 5: Speakable Schema Implementation

**Add speakable schema to voice-optimized sections:**

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".voice-answer", ".key-takeaway"]
  },
  "mainEntity": {
    "@type": "Question",
    "name": "Is email marketing still effective?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, email marketing is still highly effective. It generates an average return of $42 for every dollar spent, making it one of the highest-ROI marketing channels available."
    }
  }
}
```

**HTML implementation:**
```html
<div class="voice-answer" itemscope itemtype="https://schema.org/Answer">
  <p itemprop="text">Yes, email marketing is still highly effective.
  It generates an average return of $42 for every dollar spent.</p>
</div>
```

## Phase 6: Local Voice Optimization

**For businesses with local presence:**

1. **Optimize Google Business Profile**
   - Complete all fields
   - Add FAQ to GBP
   - Respond to Q&A section

2. **Target "near me" variations**
   - "[Service] near me"
   - "[Service] in [city]"
   - "Best [service] [location]"
   - "[Service] open now"

3. **Include location context**
   - Mention city/neighborhood in content
   - Include address prominently
   - List service areas

## Phase 7: Voice Search Testing

**Test your optimization:**

1. Use Google Assistant, Siri, or Alexa
2. Ask your target questions
3. Note what answer is read
4. Compare to your content
5. Iterate based on results

**Voice search ranking factors:**
- Page speed (voice prefers fast-loading)
- HTTPS (required)
- Featured snippet status
- Domain authority
- Content directly answers query

</process>

<voice_templates>

**Definition Answer:**
```
## What is [Term]?

[Term] is [simple definition in under 25 words]. [One sentence of context]. [One sentence on why it matters].
```

**How-To Answer:**
```
## How Do I [Action]?

To [action], you need to [core requirement]. Start by [first step], then [second step]. Most people can [action] in [timeframe].
```

**Yes/No Answer:**
```
## Can I [Question]?

[Yes/No], you [can/cannot] [action]. [Reason in one sentence]. [Important caveat or context].
```

**Best/Recommendation Answer:**
```
## What's the Best [Category]?

The best [category] is [recommendation] because [primary reason]. It [key benefit] and [secondary benefit]. [Alternative mention if relevant].
```

</voice_templates>

<success_criteria>
- 20+ voice query targets identified
- Content restructured with direct answers
- Speakable schema implemented
- Conversational tone achieved (Flesch 60+)
- FAQ sections added for question clusters
- Local optimization completed (if applicable)
- Voice search testing conducted
</success_criteria>
