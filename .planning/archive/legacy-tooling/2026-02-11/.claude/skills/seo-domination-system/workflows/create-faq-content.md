# Create FAQ Content Workflow

<objective>
Create optimized FAQ sections designed to capture "People Also Ask" positions and featured snippets. Output: Ready-to-publish FAQ content with schema markup.
</objective>

<inputs_required>
- Target keyword/topic
- Page URL where FAQ will be added
- Competitor FAQ examples
- Customer questions (from calls, support, sales)
</inputs_required>

<process>

## Phase 1: Question Research

**Source 1: Google PAA Mining**

```
1. Google your target keyword
2. Find "People Also Ask" box
3. Click each question to expand more
4. Keep clicking until you have 15-20 questions
5. Document all questions exactly as phrased
```

**Source 2: Customer Conversations**

Pull questions from:
- Sales call recordings
- Support tickets
- Live chat logs
- Email inquiries
- Social media comments
- Reviews (questions within reviews)

**Source 3: Competitor FAQs**

```
1. Google "[competitor] FAQ" or visit their pages
2. Document their FAQ questions
3. Identify gaps you can fill
4. Note which questions get featured snippets
```

**Source 4: Question Research Tools**

- AnswerThePublic (3/day free)
- AlsoAsked (3/day free)
- Quora (search your topic)
- Reddit (search subreddits in your niche)

**Document questions in this format:**

| Question | Source | Search Volume | PAA Position? | Priority |
|----------|--------|---------------|---------------|----------|
| How long does X take? | PAA | 720 | Yes | High |
| Is X worth it? | Customer | Unknown | Yes | High |
| What's the difference between X and Y? | Competitor | 480 | No | Medium |

## Phase 2: Question Selection

**Select 5-10 questions per FAQ section based on:**

✅ **Include if:**
- Appears in PAA for your target keyword
- Asked frequently by real customers
- Provides genuinely useful information
- Can be answered authoritatively
- Supports your page's primary topic

❌ **Exclude if:**
- Self-promotional ("Why is [Brand] the best?")
- Already answered in main content
- Requires one-word answers only
- Not relevant to page topic
- Competitors don't cover it AND no search demand

**Question type balance:**

| Question Type | Target | Example |
|---------------|--------|---------|
| What is / Definition | 1-2 | "What is call recording software?" |
| How to / Process | 2-3 | "How do I record Zoom calls?" |
| Why / Benefit | 1-2 | "Why should coaches record calls?" |
| How much / Pricing | 1 | "How much does X cost?" |
| Comparison | 1-2 | "What's the difference between X and Y?" |
| Troubleshooting | 1 | "Why isn't my recording working?" |

## Phase 3: Answer Writing

**Answer formula:**

```
Sentence 1: Direct answer to the question
Sentence 2-3: Supporting context or explanation
Sentence 4: Additional value, next step, or important caveat
Total: 50-75 words (optimal for featured snippets)
```

**Answer templates by question type:**

### Definition Questions ("What is X?")
```
[X] is [category] that [primary function]. It [key characteristic]
and helps [target user] [achieve benefit]. Most [users] use [X]
for [primary use case].
```

**Example:**
```
Q: What is call recording software?

A: Call recording software automatically captures and stores audio
or video from phone calls and virtual meetings. It creates searchable
archives of conversations that professionals can reference later.
Most coaches and consultants use it to review client sessions,
extract insights, and improve their practice over time.
```

### How-To Questions ("How do I X?")
```
To [X], [first step]. Then [second step]. Finally, [third step].
The process typically takes [timeframe] and requires [requirements].
```

**Example:**
```
Q: How do I record a Zoom call?

A: To record a Zoom call, click the "Record" button in the meeting
toolbar. Choose whether to save locally or to the cloud. When the
meeting ends, Zoom will process and save your recording. The process
is automatic—just remember to click Record at the start of each call
you want to capture.
```

### Why Questions ("Why should I X?")
```
[X] because [primary reason]. This means [benefit to user]. Studies
show [supporting evidence or statistic]. Without [X], [negative
consequence].
```

**Example:**
```
Q: Why should coaches record their client calls?

A: Coaches should record client calls because valuable insights often
surface mid-conversation and are easily forgotten. Recording creates
a searchable library of breakthroughs, patterns, and client progress.
Research shows professionals retain only 10% of verbal conversations.
Without recordings, you're losing 90% of your best coaching moments.
```

### How Much Questions ("How much does X cost?")
```
[X] typically costs [range] depending on [factors]. [Entry option]
starts at [price] while [premium option] runs [price]. Most [users]
spend [average] for [standard package].
```

**Example:**
```
Q: How much does call recording software cost?

A: Call recording software typically costs $0-50/month per user
depending on features and storage. Free options like Fathom offer
basic recording. Mid-tier tools run $15-30/month with AI features.
Most coaches spend $20-25/month for unlimited recording and
searchable transcripts.
```

### Comparison Questions ("What's the difference between X and Y?")
```
The main difference between [X] and [Y] is [key differentiator]. [X]
is best for [use case] while [Y] works better for [other use case].
Choose [X] if [criteria] or [Y] if [other criteria].
```

**Example:**
```
Q: What's the difference between Fathom and Otter.ai?

A: The main difference is Fathom is designed for meeting participants
while Otter.ai is built for transcription-only use cases. Fathom
integrates directly with video calls and automatically captures
everything. Choose Fathom if you run live video calls or Otter
if you need to transcribe pre-recorded audio files.
```

## Phase 4: Format for Implementation

**HTML structure:**

```html
<section class="faq-section">
  <h2>Frequently Asked Questions About [Topic]</h2>

  <div class="faq-item" itemscope itemprop="mainEntity"
       itemtype="https://schema.org/Question">
    <h3 itemprop="name">Question text here?</h3>
    <div itemscope itemprop="acceptedAnswer"
         itemtype="https://schema.org/Answer">
      <p itemprop="text">Answer text here...</p>
    </div>
  </div>

  <!-- Repeat for each FAQ -->
</section>
```

**JSON-LD Schema (add to page):**

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question 1 text?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer 1 text..."
      }
    },
    {
      "@type": "Question",
      "name": "Question 2 text?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer 2 text..."
      }
    }
  ]
}
</script>
```

## Phase 5: Placement Strategy

**Where to put FAQ on page:**

| Page Type | FAQ Placement |
|-----------|---------------|
| Blog post | After main content, before CTA |
| Product page | Below product details |
| Service page | After service description |
| Landing page | Above footer |
| Pillar page | Before conclusion |

**Design recommendations:**
- Accordion style for 5+ questions
- First 2-3 questions expanded by default
- Clear visual separation from main content
- Mobile-friendly tap targets

## Phase 6: Quality Checklist

**Before publishing, verify:**

- [ ] All questions match actual search queries
- [ ] Answers are 50-75 words (snippet-optimized)
- [ ] First sentence directly answers the question
- [ ] No self-promotional language in answers
- [ ] Schema validates in Google Rich Results Test
- [ ] FAQ is visible on page (not hidden)
- [ ] Mobile display looks good
- [ ] Internal links added where relevant

</process>

<faq_output_template>

```markdown
# FAQ Section for [Page Title]
Target Keyword: [keyword]

---

## FAQ Content

### Q1: [Question from PAA]?

[50-75 word answer following the formula]

---

### Q2: [Question from customers]?

[50-75 word answer following the formula]

---

### Q3: [How-to question]?

[50-75 word answer with steps]

---

### Q4: [Comparison question]?

[50-75 word answer with clear differentiation]

---

### Q5: [Pricing/cost question]?

[50-75 word answer with specific numbers]

---

## JSON-LD Schema (copy to page)

[Full JSON-LD block]

---

## Implementation Notes

- Placement: [where on page]
- Design: [accordion/expanded]
- Related internal links: [suggestions]
```

</faq_output_template>

<success_criteria>
- 5-10 relevant questions researched
- All answers follow 50-75 word formula
- JSON-LD schema generated and validated
- HTML structure provided
- Placement recommendation included
- Content ready for immediate implementation
</success_criteria>
