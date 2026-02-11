# FAQ Schema Strategy Workflow

<objective>
Implement FAQ schema markup to capture "People Also Ask" real estate and enhance SERP visibility. Output: FAQ content with proper schema ready for implementation.
</objective>

<inputs_required>
- Target page URLs
- Primary keywords for each page
- Existing FAQ content (if any)
- Competitor FAQ examples
</inputs_required>

<process>

## Phase 1: PAA Research

**Mine "People Also Ask" for your keywords:**

```
For each target keyword:
1. Google the keyword
2. Find the PAA box (usually after position 1-3)
3. Click each question to expand more
4. Document all questions revealed
5. Note which questions appear most frequently
```

**PAA research tools:**
- AlsoAsked.com (3/day free) - Maps the PAA tree
- AnswerThePublic (3/day free) - Question variations
- Manual SERP analysis - Most accurate

**Document in this format:**

| Primary Keyword | PAA Question | Search Intent | Priority |
|-----------------|--------------|---------------|----------|
| [keyword] | [question 1] | Informational | High |
| [keyword] | [question 2] | Comparison | Medium |
| [keyword] | [question 3] | How-to | High |

## Phase 2: FAQ Content Strategy

**Determine FAQ placement:**

| Page Type | FAQ Strategy |
|-----------|--------------|
| Blog Post | End of article + inline where relevant |
| Product Page | Below product details |
| Service Page | After service description |
| Homepage | Usually not recommended |
| Category Page | Above footer, after products |

**FAQ question selection criteria:**

✅ Include if:
- Appears in PAA for your keywords
- Addresses common objections
- Covers pre-purchase questions
- Provides genuinely useful information

❌ Avoid:
- Questions no one asks
- Self-promotional "questions"
- Duplicate content from main page
- Questions with one-word answers

## Phase 3: Writing FAQ Answers

**Answer format guidelines:**

```
Question: [Exact PAA question or common query]

Answer structure:
- Sentence 1: Direct answer (yes/no/the thing itself)
- Sentence 2-3: Supporting context or explanation
- Sentence 4: Additional value or next step
- Total: 50-75 words (sweet spot for featured snippets)
```

**Example FAQ entries:**

```
Q: How long does SEO take to work?

A: SEO typically takes 3-6 months to show significant results, though
some improvements can appear within weeks. The timeline depends on
your site's current authority, competition level, and the scope of
optimization. Newer sites generally take longer than established
domains to see ranking improvements.
```

```
Q: Is SEO worth it for small businesses?

A: Yes, SEO is worth it for small businesses because it provides
sustainable traffic without ongoing ad costs. Unlike paid advertising,
SEO builds long-term visibility that compounds over time. Small
businesses often see strong ROI because they can target specific
local and niche keywords with less competition.
```

**Avoid these FAQ mistakes:**
- Starting answers with "Great question!"
- Repeating the question in the answer
- Overly long answers (150+ words)
- Promotional language instead of helpful info
- Linking away in the answer (reduces schema benefit)

## Phase 4: FAQ Schema Implementation

**JSON-LD FAQ Schema (recommended):**

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does SEO take to work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SEO typically takes 3-6 months to show significant results, though some improvements can appear within weeks. The timeline depends on your site's current authority, competition level, and the scope of optimization. Newer sites generally take longer than established domains to see ranking improvements."
      }
    },
    {
      "@type": "Question",
      "name": "Is SEO worth it for small businesses?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, SEO is worth it for small businesses because it provides sustainable traffic without ongoing ad costs. Unlike paid advertising, SEO builds long-term visibility that compounds over time. Small businesses often see strong ROI because they can target specific local and niche keywords with less competition."
      }
    }
  ]
}
</script>
```

**HTML + Microdata alternative:**

```html
<div itemscope itemtype="https://schema.org/FAQPage">
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">How long does SEO take to work?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">SEO typically takes 3-6 months to show
      significant results...</p>
    </div>
  </div>
</div>
```

## Phase 5: Technical Validation

**Validate schema before publishing:**

1. Google Rich Results Test: https://search.google.com/test/rich-results
2. Schema.org Validator: https://validator.schema.org/
3. Check for errors and warnings
4. Fix any issues before deployment

**Common schema errors:**
- Missing required properties
- HTML entities in JSON (use escaped quotes)
- Duplicate FAQ schema on same page
- FAQ schema on pages without visible FAQ content

**Google's FAQ schema guidelines:**
- FAQ must be visible on the page (not hidden)
- One FAQ schema per page
- Don't use for customer service FAQ (use Q&A Page instead)
- Answers should be complete (not "contact us for more info")

## Phase 6: FAQ Section Design

**Best practices for visible FAQ:**

```html
<section class="faq-section">
  <h2>Frequently Asked Questions About [Topic]</h2>

  <div class="faq-item">
    <h3>Question here?</h3>
    <p>Answer here...</p>
  </div>

  <!-- Accordion optional but common -->
</section>
```

**UX considerations:**
- Place after main content, before CTA
- Use accordion for 5+ questions
- Keep visible by default for first 2-3 questions
- Ensure mobile-friendly expansion

## Phase 7: Monitoring Results

**Track FAQ schema performance:**

1. **Google Search Console:**
   - Search Appearance → FAQ rich results
   - Monitor impressions and clicks
   - Note which pages generate FAQ appearances

2. **Manual SERP checks:**
   - Google your keywords
   - Look for FAQ dropdowns under your listing
   - Compare to competitors

3. **Iterate:**
   - Add new questions based on PAA changes
   - Update answers if information changes
   - Remove questions that don't perform

</process>

<faq_templates>

**5-Question FAQ Block:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is [service/product]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Definition answer 50-75 words]"
      }
    },
    {
      "@type": "Question",
      "name": "How much does [service/product] cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Pricing answer with ranges or 'starting at']"
      }
    },
    {
      "@type": "Question",
      "name": "How long does [process] take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Timeline answer with realistic expectations]"
      }
    },
    {
      "@type": "Question",
      "name": "Why should I choose [brand/solution]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Differentiation answer - factual, not salesy]"
      }
    },
    {
      "@type": "Question",
      "name": "[Top PAA question for your keyword]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Helpful answer to common query]"
      }
    }
  ]
}
```

</faq_templates>

<success_criteria>
- PAA questions researched for all target keywords
- 5-10 FAQ entries written per page
- Schema validated with Google Rich Results Test
- FAQ visible on page (not just in code)
- Tracking set up in Search Console
- Competitor FAQ analysis completed
</success_criteria>
