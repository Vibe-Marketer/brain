# RAG Retrieval Testing Guide

## Overview

The `test-rag-retrieval.ts` script measures the quality of your hybrid search RAG implementation using standard information retrieval metrics.

## Installation

First, install the required dependency:

```bash
npm install
```

This will install `tsx` (TypeScript executor) which is needed to run the script.

## Required Environment Variables

Make sure these are set in your `.env` file:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

## Usage

### Method 1: Direct Execution

```bash
npx tsx scripts/test-rag-retrieval.ts <user_id>
```

Example:
```bash
npx tsx scripts/test-rag-retrieval.ts 550e8400-e29b-41d4-a716-446655440000
```

### Method 2: NPM Script

```bash
npm run test:rag <user_id>
```

Example:
```bash
npm run test:rag 550e8400-e29b-41d4-a716-446655440000
```

### Method 3: Environment Variable

Set the user ID in your environment:

```bash
export TEST_USER_ID=550e8400-e29b-41d4-a716-446655440000
npm run test:rag
```

## How to Get Your User ID

You can find your user ID in several ways:

### Option 1: From Supabase Dashboard
1. Go to your Supabase project
2. Navigate to Authentication > Users
3. Find your user and copy the UUID

### Option 2: From Browser Console
1. Open your Conversion Brain app
2. Open browser DevTools (F12)
3. Run in console:
```javascript
const { data } = await supabase.auth.getUser();
console.log(data.user.id);
```

### Option 3: Using SQL
```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

## Understanding the Metrics

### MRR (Mean Reciprocal Rank)

**What it measures:** How quickly you find the first relevant result.

**Formula:** `1 / rank_of_first_relevant_result`

**Example:**
- First result is relevant: MRR = 1.0
- Second result is relevant: MRR = 0.5
- Third result is relevant: MRR = 0.333
- No relevant results: MRR = 0.0

**Interpretation:**
- **MRR > 0.8** = Excellent (first relevant result in top 1-2)
- **MRR > 0.5** = Good (first relevant result in top 2-3)
- **MRR > 0.3** = Fair (first relevant result in top 3-4)
- **MRR < 0.3** = Needs improvement

### Precision@K

**What it measures:** What percentage of the top K results are relevant.

**Formula:** `relevant_in_top_k / k`

**Example (Precision@5):**
- 4 out of top 5 are relevant: P@5 = 0.8
- 3 out of top 5 are relevant: P@5 = 0.6
- 1 out of top 5 is relevant: P@5 = 0.2

**Interpretation:**
- **P@5 > 0.8** = Excellent quality (80%+ of top 5 relevant)
- **P@5 > 0.6** = Good quality (60%+ of top 5 relevant)
- **P@5 > 0.4** = Fair quality (40%+ of top 5 relevant)
- **P@5 < 0.4** = Needs improvement

## Test Queries

The script includes 10 test queries covering common meeting transcript scenarios:

1. **Pricing objections** - Find cost/budget concerns
2. **Buying signals** - Find positive purchase indicators
3. **Integration questions** - Find API/technical questions
4. **Positive feedback** - Find testimonials
5. **Feature requests** - Find enhancement requests
6. **Security concerns** - Find data/privacy concerns
7. **Competitor mentions** - Find competitor comparisons
8. **Decision maker interest** - Find interest signals
9. **Timeline concerns** - Find implementation timeline concerns
10. **Technical API questions** - Find API-specific questions

## Customizing Test Queries

Edit `scripts/test-rag-retrieval.ts` and modify the `TEST_QUERIES` array:

```typescript
const TEST_QUERIES: TestQuery[] = [
  {
    query: "Your natural language query",
    expectedTopics: ["topic1", "topic2"],  // Topics you expect to find
    expectedIntents: ["intent1"],  // Optional: intent signals
    expectedSentiment: "positive",  // Optional: positive/negative/neutral
    description: "Human-readable description",
  },
  // Add more queries...
];
```

## Output

### Console Output

The script prints:
1. Database connection verification
2. Progress for each test query
3. Summary with average metrics
4. Interpretation guide

### JSON Report

A detailed JSON report is saved to `test-results/rag-test-{timestamp}.json` with:
- All query results
- Top 5 results per query with relevance flags
- Full metrics breakdown
- Timestamp and user ID

## Example Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║         RAG RETRIEVAL QUALITY TEST SUITE                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

User ID: 550e8400-e29b-41d4-a716-446655440000
Test Queries: 10

Found 342 transcript chunks for this user

════════════════════════════════════════════════════════════════════════════════
RUNNING TESTS
════════════════════════════════════════════════════════════════════════════════

[1/10] Find pricing-related objections

  Query: "What pricing objections did customers mention?"
  Expected: topics=[pricing, cost, budget, price, expensive]
  Results: 10 chunks, 7 relevant
  MRR: 1.000 | P@5: 0.800 | P@10: 0.700

[2/10] Find positive buying indicators
...

════════════════════════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════════════════════════

Average MRR:         0.725
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

## Baseline and Tracking Improvements

### Creating a Baseline

1. Run the test before making any RAG enhancements:
```bash
npm run test:rag <user_id> > baseline-results.txt
```

2. Save the JSON report:
```bash
cp test-results/rag-test-*.json test-results/baseline.json
```

### Testing Improvements

After making enhancements (e.g., query expansion, metadata filtering):

1. Run the test again:
```bash
npm run test:rag <user_id> > enhanced-results.txt
```

2. Compare metrics:
```bash
# View baseline
cat baseline-results.txt | grep "Average"

# View enhanced
cat enhanced-results.txt | grep "Average"
```

### Expected Improvements

With query expansion and metadata filtering, you should see:

- **MRR increase:** +10-20% (e.g., 0.65 → 0.75)
- **P@5 increase:** +5-15% (e.g., 0.60 → 0.70)
- **P@10 increase:** +5-10% (e.g., 0.55 → 0.62)

## Troubleshooting

### "No transcript chunks found"

You need to create embeddings first:
1. Use the embedding Edge Function to process transcripts
2. Verify chunks exist: `SELECT COUNT(*) FROM transcript_chunks WHERE user_id = 'your-id';`

### "OpenAI API error"

- Check your `OPENAI_API_KEY` is valid
- Verify you have API credits
- Check rate limits (script has 500ms delay between queries)

### "Supabase connection error"

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Check network connection
- Ensure RLS policies allow service role access

### "All queries returning MRR = 0"

This means no relevant results are being found. Possible causes:
1. Test queries don't match your data (customize `TEST_QUERIES`)
2. Metadata (topics, intents) not yet extracted
3. Embeddings not generated yet

## Integration with CI/CD

You can integrate this into your CI/CD pipeline:

```yaml
# .github/workflows/test-rag.yml
name: RAG Quality Test

on:
  pull_request:
    paths:
      - 'supabase/functions/**'
      - 'src/lib/rag/**'

jobs:
  test-rag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:rag
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TEST_USER_ID: ${{ secrets.TEST_USER_ID }}
```

## Next Steps

After running your baseline tests:

1. **Week 2 - Query Expansion:** Implement query expansion to improve semantic matching
2. **Week 3 - Re-ranking:** Add re-ranking to boost precision
3. **Week 4 - Metadata Filtering:** Use metadata filters to narrow results

Run this test suite after each enhancement to measure improvement!
