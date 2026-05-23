/**
 * RPC Type-Smoke Test — CI gate against the BIGINT-vs-UUID bug class.
 *
 * What this catches:
 *   - SECURITY DEFINER functions whose PARAMETER types don't match the
 *     schema column they're queried against → Postgres 22P02 / 42883.
 *   - SECURITY DEFINER functions whose RETURNS TABLE column types don't
 *     match the underlying SELECT → Postgres 42804.
 *
 * Why we built this:
 *   The same bug shipped twice in 24 hours from security-hardening PRs
 *   that weren't end-to-end tested against the real schema:
 *
 *     - 2026-05-09 (Fathom OAuth): 2 RPCs declared p_source_id BIGINT,
 *       broke new OAuth connects for 13 days. Fix in migration
 *       20260522180000_fix_oauth_rpc_uuid_types.sql.
 *     - 2026-05-23 (Fireflies cleanup #278): 4 RPCs declared id BIGINT,
 *       caught 12 min after merge by manual inspection. Fix in migration
 *       20260524010000_fix_fireflies_rpc_uuid_types.sql.
 *
 *   This bug class is invisible to type-check, lint, and unit tests that
 *   mock the RPC name without exercising the SQL signature. The only thing
 *   that catches it is calling the function against the live schema.
 *
 * How it works:
 *   This file is a thin wrapper around the SQL helper
 *   `public.verify_rpc_type_signatures()` (defined in migration
 *   20260524020000). The helper loops over every SECURITY DEFINER public
 *   function (minus the skip list at `public.rpc_type_smoke_skip_list`),
 *   smoke-calls each one inside a DO block, and returns one row per
 *   function whose call surfaces 22P02 / 42804 / 42883.
 *
 * On failure, the assertion message names every broken function +
 * error code + message — drop the migration file, fix it, push again.
 *
 * SKIP behavior: cleanly skipped when the integration DB is not
 * reachable (no test service-role key). CI runs without secrets stay green.
 */

import { describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[rpc-type-smoke]";

interface VerifyResult {
  function_signature: string;
  error_code: string;
  error_message: string;
}

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} every SECURITY DEFINER public RPC is type-safe`,
  () => {
    const admin = makeIntegrationClient();

    it("verify_rpc_type_signatures() returns zero rows", async () => {
      const { data, error } = await admin.rpc("verify_rpc_type_signatures");

      if (error) {
        throw new Error(
          `${SUITE_TAG} bootstrap failed — verify_rpc_type_signatures() not deployed or not callable. ` +
            `Apply migration 20260524020000_rpc_type_smoke_helper.sql or check service-role grants. ` +
            `Underlying: ${error.message}`,
        );
      }

      const failures = (data as VerifyResult[] | null) ?? [];

      if (failures.length > 0) {
        const detail = failures
          .map(
            (f) =>
              `  • ${f.function_signature}\n      [${f.error_code}] ${f.error_message}`,
          )
          .join("\n");
        throw new Error(
          `${SUITE_TAG} ${failures.length} SECURITY DEFINER function(s) have type-signature bugs.\n\n` +
            `These functions will throw at runtime when called from edge functions or the frontend. ` +
            `Fix the migration(s) that declared them — usually a BIGINT vs UUID mismatch on import_sources.id.\n\n` +
            `Failures:\n${detail}\n\n` +
            `To intentionally exclude a function (trigger callback, destructive sweeper, custom-type param):\n` +
            `  INSERT INTO public.rpc_type_smoke_skip_list (function_name, reason)\n` +
            `  VALUES ('<name>', '<one-line reason>');\n`,
        );
      }

      expect(failures).toEqual([]);
    });
  },
);
