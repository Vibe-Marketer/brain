import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("SyncTab connector registry routing", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const syncTabSource = readFileSync(
    join(repoRoot, "src/components/transcripts/SyncTab.tsx"),
    "utf8",
  );
  const orchestrationSource = readFileSync(
    join(repoRoot, "src/hooks/useSyncTabOrchestration.ts"),
    "utf8",
  );
  const serviceSource = readFileSync(
    join(repoRoot, "src/services/sync-tab.service.ts"),
    "utf8",
  );
  const previewHookSource = readFileSync(
    join(repoRoot, "src/hooks/useUnsyncedMeetingPreview.ts"),
    "utf8",
  );
  const transcriptDownloadSource = readFileSync(
    join(repoRoot, "src/lib/transcript-download.ts"),
    "utf8",
  );

  it("routes enabled connector fetch and import through connector adapters", () => {
    // Fetch/sync orchestration was extracted to useSyncTabOrchestration in
    // W1-D — the connector-registry routing now lives there, not in the
    // view component.
    expect(orchestrationSource).toMatch(
      /getConnectorAdapter\(integration\.platform\)/,
    );
    expect(orchestrationSource).toMatch(/searchAllAvailableCalls/);
    expect(orchestrationSource).toMatch(/getConnectorAdapter\(platform\)/);
    expect(orchestrationSource).toMatch(/adapter\.importSelected/);
  });

  it("consumes adapter pagination cursors for SyncTab connector searches", () => {
    expect(orchestrationSource).toMatch(/MAX_SYNC_TAB_SEARCH_PAGES/);
    expect(orchestrationSource).toMatch(/searchAllAvailableConnectorCalls/);
    expect(orchestrationSource).toMatch(
      /searchAvailable: adapter\.searchAvailable/,
    );
    expect(orchestrationSource).toMatch(/maxPages: MAX_SYNC_TAB_SEARCH_PAGES/);
  });

  it("keeps direct Fathom edge calls only as a legacy source-less fallback (in the service)", () => {
    // Fathom-legacy edge invocations live in sync-tab.service.ts. The
    // orchestration hook routes through `usesLegacySourceLessSync` to
    // decide which path to call. SyncTab itself contains neither helper.
    expect(orchestrationSource).toMatch(/usesLegacySourceLessSync/);
    expect(orchestrationSource).toMatch(/invokeFathomFetchMeetings/);
    expect(orchestrationSource).toMatch(/invokeSyncMeetingsForTab/);
    expect(serviceSource).toMatch(
      /supabase\.functions\.invoke\("fetch-meetings"/,
    );
    expect(serviceSource).toMatch(
      /supabase\.functions\.invoke\("sync-meetings"/,
    );
    expect(orchestrationSource).not.toMatch(
      /platform === "fathom" && !integration/,
    );
  });

  it("does not hardcode Zoom edge function calls in SyncTab or its orchestration", () => {
    expect(syncTabSource).not.toMatch(/zoom-fetch-meetings|zoom-sync-meetings/);
    expect(orchestrationSource).not.toMatch(
      /zoom-fetch-meetings|zoom-sync-meetings/,
    );
  });

  it("uses the enabled connector source for workspace defaults", () => {
    expect(syncTabSource).toMatch(/workspaceDefaultSource/);
    expect(syncTabSource).toMatch(/integration=\{workspaceDefaultSource\}/);
    expect(syncTabSource).not.toMatch(
      /<WorkspaceSelector[\s\S]*integration="fathom"/,
    );
  });

  it("uses shared source selection helpers instead of inline Fathom defaults", () => {
    expect(syncTabSource).toMatch(/getMeetingSourcePlatform\(t\)/);
    expect(syncTabSource).not.toMatch(/source_platform \|\| ['"]fathom['"]/);
    expect(orchestrationSource).toMatch(/getMeetingSourcePlatform/);
    expect(orchestrationSource).not.toMatch(
      /source_platform \|\| ['"]fathom['"]/,
    );
  });

  it("keeps unsynced preview and download source-aware", () => {
    // Preview/download flow lives in useUnsyncedMeetingPreview; the
    // connector-vs-Fathom branch lives there and the connector format helper
    // lives in lib/transcript-download.
    expect(previewHookSource).toMatch(/getMeetingSourcePlatform\(meeting\)/);
    expect(previewHookSource).toMatch(/formatConnectorUnsyncedMeeting/);
    expect(transcriptDownloadSource).toMatch(/formatConnectorUnsyncedMeeting/);
    expect(syncTabSource).not.toMatch(/useMeetingsSync\(/);
    expect(syncTabSource).not.toMatch(/hookDownloadUnsyncedTranscript/);
  });

  it("does not route unsynced-table actions through the legacy single Fathom insert path", () => {
    expect(syncTabSource).not.toMatch(/syncSingleMeeting/);
    expect(syncTabSource).not.toMatch(/hookSyncSingleMeeting/);
    expect(syncTabSource).not.toMatch(/onDirectCategorize/);
  });

  it("keeps the view component free of direct supabase data-access", () => {
    expect(syncTabSource).not.toMatch(/supabase\.from\(/);
    expect(syncTabSource).not.toMatch(/supabase\.functions\.invoke\(/);
    // The orchestration hook routes through the service — no direct
    // supabase data-access either.
    expect(orchestrationSource).not.toMatch(/supabase\.from\(/);
    expect(orchestrationSource).not.toMatch(/supabase\.functions\.invoke\(/);
  });
});
