# Example Test Output

This shows what you'll see when running the RAG retrieval tests.

## Running the Test

```bash
npm run test:rag 550e8400-e29b-41d4-a716-446655440000
```

## Console Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║         RAG RETRIEVAL QUALITY TEST SUITE                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

User ID: 550e8400-e29b-41d4-a716-446655440000
Test Queries: 10

Checking database connection...
Found 342 transcript chunks for this user

════════════════════════════════════════════════════════════════════════════════
RUNNING TESTS
════════════════════════════════════════════════════════════════════════════════

[1/10] Find pricing-related objections

  Query: "What pricing objections did customers mention?"
  Expected: topics=[pricing, cost, budget, price, expensive], intents=[objection, concern]
  Results: 10 chunks, 7 relevant
  MRR: 1.000 | P@5: 0.800 | P@10: 0.700

[2/10] Find positive buying indicators

  Query: "Show me buying signals from prospects"
  Expected: topics=[decision, purchase, timeline, contract, deal], intents=[buying_signal], sentiment=positive
  Results: 10 chunks, 5 relevant
  MRR: 0.500 | P@5: 0.600 | P@10: 0.500

[3/10] Find integration-related questions

  Query: "What questions did customers ask about integrations?"
  Expected: topics=[integration, api, technical, connect, sync], intents=[question]
  Results: 10 chunks, 8 relevant
  MRR: 1.000 | P@5: 0.800 | P@10: 0.800

[4/10] Find positive testimonials

  Query: "Find positive feedback about the product"
  Expected: topics=[feedback, review, experience, satisfaction], intents=[testimonial], sentiment=positive
  Results: 10 chunks, 6 relevant
  MRR: 0.500 | P@5: 0.600 | P@10: 0.600

[5/10] Find feature requests

  Query: "What feature requests came up in calls?"
  Expected: topics=[feature, improvement, wishlist, enhancement], intents=[feature_request]
  Results: 10 chunks, 9 relevant
  MRR: 1.000 | P@5: 1.000 | P@10: 0.900

[6/10] Find security-related concerns

  Query: "Show me concerns about data security"
  Expected: topics=[security, data, privacy, compliance, encryption], intents=[concern, objection]
  Results: 10 chunks, 4 relevant
  MRR: 0.333 | P@5: 0.400 | P@10: 0.400

[7/10] Find competitor mentions

  Query: "What did customers say about competitor products?"
  Expected: topics=[competitor, comparison, alternative], intents=[comparison]
  Results: 10 chunks, 3 relevant
  MRR: 0.500 | P@5: 0.400 | P@10: 0.300

[8/10] Find decision maker interest signals

  Query: "Find decision makers expressing interest"
  Expected: topics=[decision, interest, evaluate, consider], intents=[buying_signal]
  Results: 10 chunks, 7 relevant
  MRR: 1.000 | P@5: 0.800 | P@10: 0.700

[9/10] Find timeline-related concerns

  Query: "What implementation timeline concerns were raised?"
  Expected: topics=[timeline, implementation, deployment, onboarding], intents=[concern, question]
  Results: 10 chunks, 5 relevant
  MRR: 0.333 | P@5: 0.600 | P@10: 0.500

[10/10] Find API-related technical questions

  Query: "Show me technical questions about the API"
  Expected: topics=[api, technical, integration, endpoint], intents=[question]
  Results: 10 chunks, 8 relevant
  MRR: 1.000 | P@5: 0.800 | P@10: 0.800

════════════════════════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════════════════════════

Average MRR:         0.717
Average P@5:         0.680
Average P@10:        0.620

INTERPRETATION:
  MRR > 0.8  = Excellent (first relevant result in top 1-2)
  MRR > 0.5  = Good (first relevant result in top 2-3)
  MRR > 0.3  = Fair (first relevant result in top 3-4)
  MRR < 0.3  = Needs improvement

  P@5 > 0.8  = Excellent quality (80%+ of top 5 relevant)
  P@5 > 0.6  = Good quality (60%+ of top 5 relevant)
  P@5 > 0.4  = Fair quality (40%+ of top 5 relevant)
  P@5 < 0.4  = Needs improvement

Full report saved to: test-results/rag-test-2025-11-26T01-23-45.json

```

## Analysis of Results

### Overall Performance

- **MRR: 0.717** - Good! First relevant result typically in top 2-3
- **P@5: 0.680** - Good! About 68% of top 5 results are relevant
- **P@10: 0.620** - Good! About 62% of top 10 results are relevant

### Strong Areas

1. **Feature requests** (MRR: 1.000, P@5: 1.000) - Excellent!
2. **Integration questions** (MRR: 1.000, P@5: 0.800) - Excellent!
3. **API questions** (MRR: 1.000, P@5: 0.800) - Excellent!
4. **Decision maker signals** (MRR: 1.000, P@5: 0.800) - Excellent!
5. **Pricing objections** (MRR: 1.000, P@5: 0.800) - Excellent!

### Areas for Improvement

1. **Competitor mentions** (MRR: 0.500, P@5: 0.400) - Fair, could use query expansion
2. **Security concerns** (MRR: 0.333, P@5: 0.400) - Fair, needs better semantic matching
3. **Timeline concerns** (MRR: 0.333, P@5: 0.600) - Fair MRR but decent P@5

### Improvement Opportunities

#### Week 2: Query Expansion

Focus on queries with low MRR:

- Expand "competitor" → ["alternative", "vs", "compared to"]
- Expand "security" → ["privacy", "compliance", "GDPR", "encryption"]
- Expand "timeline" → ["schedule", "when", "how long", "deadline"]

Expected improvement: +15-20% MRR on these queries

#### Week 3: Re-ranking

Boost precision for all queries:

- Use cross-encoder re-ranking for top 20 results
- Apply metadata boosting (intent_signals weight)
- Recency weighting for time-sensitive queries

Expected improvement: +5-10% P@5 across all queries

---

## JSON Report Sample

The JSON report (`test-results/rag-test-2025-11-26T01-23-45.json`) contains:

```json
{
  "timestamp": "2025-11-26T01:23:45.678Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "totalQueries": 10,
  "metrics": {
    "averageMRR": 0.717,
    "averagePrecisionAt5": 0.680,
    "averagePrecisionAt10": 0.620
  },
  "queryResults": [
    {
      "query": "What pricing objections did customers mention?",
      "description": "Find pricing-related objections",
      "mrr": 1.0,
      "precisionAt5": 0.8,
      "precisionAt10": 0.7,
      "topResults": [
        {
          "rank": 1,
          "isRelevant": true,
          "snippet": "Well, the pricing seems a bit high compared to what we're paying for Salesforce right now. Is there any flexibility on that?",
          "topics": ["pricing", "objection", "comparison"],
          "intent": ["concern", "objection"],
          "rrfScore": 0.0325
        },
        {
          "rank": 2,
          "isRelevant": true,
          "snippet": "Our budget for Q4 is pretty tight. Can we phase the implementation to spread the cost?",
          "topics": ["budget", "timeline", "implementation"],
          "intent": ["concern", "question"],
          "rrfScore": 0.0298
        },
        {
          "rank": 3,
          "isRelevant": true,
          "snippet": "The per-seat pricing makes sense but we have 200 employees. Any volume discounts available?",
          "topics": ["pricing", "volume"],
          "intent": ["question"],
          "rrfScore": 0.0271
        },
        {
          "rank": 4,
          "isRelevant": true,
          "snippet": "I like the features but need to justify the cost to my CFO. What's the typical ROI timeline?",
          "topics": ["pricing", "roi", "justification"],
          "intent": ["concern", "question"],
          "rrfScore": 0.0245
        },
        {
          "rank": 5,
          "isRelevant": true,
          "snippet": "We're comparing three vendors right now and you're the most expensive. What makes you worth it?",
          "topics": ["pricing", "comparison", "competitor"],
          "intent": ["objection", "comparison"],
          "rrfScore": 0.0219
        }
      ],
      "totalReturned": 10,
      "relevantCount": 7
    }
    // ... 9 more query results
  ]
}
```

---

## What to Do Next

### 1. Create Baseline

```bash
# Save this as your baseline before any enhancements
npm run test:rag <user_id> > baseline-2025-11-26.txt
cp test-results/rag-test-*.json test-results/baseline-2025-11-26.json
```

### 2. Implement Week 2 Enhancements

- Query expansion for low MRR queries
- Synonym mapping for domain terms
- User vocabulary adaptation

### 3. Re-test and Compare

```bash
npm run test:rag <user_id> > enhanced-week2.txt
diff baseline-2025-11-26.txt enhanced-week2.txt
```

### 4. Implement Week 3 Enhancements

- Cross-encoder re-ranking
- Metadata boosting
- Recency weighting

### 5. Final Measurement

```bash
npm run test:rag <user_id> > enhanced-final.txt

# Compare all versions
echo "=== BASELINE ==="
grep "Average" baseline-2025-11-26.txt

echo "=== AFTER WEEK 2 ==="
grep "Average" enhanced-week2.txt

echo "=== FINAL ==="
grep "Average" enhanced-final.txt
```

---

## Expected Progression

| Metric | Baseline | After Week 2 | After Week 3 | Target |
|--------|----------|--------------|--------------|--------|
| MRR | 0.717 | 0.800+ | 0.850+ | 0.800+ |
| P@5 | 0.680 | 0.720+ | 0.800+ | 0.750+ |
| P@10 | 0.620 | 0.660+ | 0.720+ | 0.700+ |

**Goal:** MRR > 0.8 and P@5 > 0.75 indicates production-ready RAG quality
