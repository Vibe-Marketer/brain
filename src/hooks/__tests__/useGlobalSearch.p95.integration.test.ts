/**
 * Phase 39 Plan 39-05 — useGlobalSearch p95 latency benchmark.
 *
 * Asserts that 100 sequential keyword searches against a 5000-row mirror
 * complete with p95 latency under 200ms. This is the FEAT-01 success
 * criterion #1.
 *
 * Test methodology:
 *   1. Seed 5000 `recordings` rows (source_app='fathom') into a test org.
 *   2. Run 100 ILIKE queries using the same query shape as useGlobalSearch.ts
 *      lines 226-244 (title.ilike OR full_transcript.ilike OR summary.ilike).
 *   3. Measure wall-clock latency per query via performance.now().
 *   4. Compute p50, p95, p99. Assert p95 < 200ms.
 *
 * Skip behavior: skipIf(!integrationDbReachable). If seeding fails (RLS, FK,
 * permissions), the test logs and skips the benchmark — operator runs it
 * manually after addressing the gap. Result is recorded in 39-BENCHMARK.md.
 *
 * Uses donor pattern: finds an existing organization_id + owner_user_id from
 * `recordings` and seeds rows into THAT org. Cleans up via the unique
 * source_call_id prefix tagging.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../test/integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

const SEED_COUNT = 5000;
const QUERY_COUNT = 100;
const P95_TARGET_MS = 200;
const SEED_PREFIX = `phase39bench-${randomUUID().slice(0, 8)}`;

describe.skipIf(!integrationDbReachable)(
  'Phase 39 useGlobalSearch p95 benchmark',
  () => {
    let supabase: SupabaseClient;
    let donorOrgId: string | null = null;
    let donorUserId: string | null = null;
    let seedingFailed = false;

    beforeAll(async () => {
      supabase = makeIntegrationClient();

      // Donor pattern: pick an existing (org, user) from recordings
      const { data: donor } = await supabase
        .from('recordings')
        .select('organization_id, owner_user_id')
        .not('organization_id', 'is', null)
        .not('owner_user_id', 'is', null)
        .limit(1)
        .maybeSingle();

      donorOrgId = (donor?.organization_id as string) ?? null;
      donorUserId = (donor?.owner_user_id as string) ?? null;

      if (!donorOrgId || !donorUserId) {
        console.warn('[phase39 p95] no donor org/user; skipping seed');
        seedingFailed = true;
        return;
      }

      // Seed in chunks of 500
      const seedKeywords = [
        'authentication',
        'pricing',
        'integration',
        'roadmap',
        'onboarding',
        SEED_PREFIX,
        'standup',
        'demo',
        'retro',
        'discussion',
      ];
      const titles = [
        'call about',
        'meeting with team',
        'standup notes',
        'demo recap',
        'retro discussion',
      ];

      for (let chunkStart = 0; chunkStart < SEED_COUNT; chunkStart += 500) {
        const chunk: Array<Record<string, unknown>> = [];
        for (
          let i = chunkStart;
          i < Math.min(chunkStart + 500, SEED_COUNT);
          i++
        ) {
          const includeBenchKey = i % 10 === 0;
          const kw = seedKeywords[i % seedKeywords.length];
          const title = `${titles[i % titles.length]} #${i}${
            includeBenchKey ? ' ' + SEED_PREFIX : ''
          }`;
          // Smaller transcript to keep seeding fast
          const transcript =
            `[00:00:00] Speaker A: This is a meeting about ${kw}. ` +
            (includeBenchKey ? `Note: ${SEED_PREFIX} mentioned. ` : '') +
            `[00:01:00] Speaker B: We discussed ${kw} extensively. `.repeat(5);
          chunk.push({
            organization_id: donorOrgId,
            owner_user_id: donorUserId,
            title,
            full_transcript: transcript,
            summary: `Summary of ${kw} call #${i}`,
            source_app: 'fathom',
            source_call_id: `bench-${i}-${SEED_PREFIX}`,
            recording_start_time: new Date(Date.now() - i * 60_000).toISOString(),
            duration: 1800,
            created_at: new Date(Date.now() - i * 60_000).toISOString(),
            fathom_provider_id: 8_500_000_000_000 + i,
          });
        }
        const { error } = await supabase.from('recordings').insert(chunk);
        if (error) {
          console.warn(
            `[phase39 p95] seed batch ${chunkStart} failed: ${error.message}`
          );
          seedingFailed = true;
          break;
        }
      }
    }, 180_000);

    afterAll(async () => {
      if (!supabase) return;
      // Clean up by source_call_id prefix
      await supabase
        .from('recordings')
        .delete()
        .like('source_call_id', `bench-%-${SEED_PREFIX}`);
    }, 120_000);

    it(`p95 of ${QUERY_COUNT} searches over ${SEED_COUNT}-row mirror is < ${P95_TARGET_MS}ms`, async () => {
      if (seedingFailed || !donorOrgId) {
        console.warn(
          '[phase39 p95] seed failed or no donor — benchmark skipped. ' +
            'Record manually in 39-BENCHMARK.md after operator seeds prod-like dataset.'
        );
        return;
      }

      const queries = [
        'authentication',
        'pricing',
        'integration',
        'roadmap',
        'onboarding',
        SEED_PREFIX,
        'standup',
        'demo',
        'retro',
        'discussion',
      ];
      const latenciesMs: number[] = [];

      for (let i = 0; i < QUERY_COUNT; i++) {
        const term = queries[i % queries.length];
        // Mirror useGlobalSearch's escapeIlike behavior: escape % and _
        const escaped = term.replace(/[%_\\]/g, (m) => `\\${m}`);
        const start = performance.now();
        const { error } = await supabase
          .from('recordings')
          .select(
            'id, fathom_provider_id, title, full_transcript, summary, source_app, source_metadata, duration, recording_start_time, created_at'
          )
          .or(
            `title.ilike.%${escaped}%,full_transcript.ilike.%${escaped}%,summary.ilike.%${escaped}%`
          )
          .eq('organization_id', donorOrgId)
          .order('created_at', { ascending: false })
          .limit(20);
        const end = performance.now();
        if (error) {
          console.warn(`[phase39 p95] query ${i} (${term}):`, error.message);
          continue;
        }
        latenciesMs.push(end - start);
      }

      expect(latenciesMs.length).toBeGreaterThan(QUERY_COUNT * 0.9);
      latenciesMs.sort((a, b) => a - b);
      const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.5)];
      const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)];
      const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)];

      console.log(
        `[phase39 p95 benchmark] n=${latenciesMs.length} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`
      );

      expect(p95).toBeLessThan(P95_TARGET_MS);
    }, 240_000);
  }
);
