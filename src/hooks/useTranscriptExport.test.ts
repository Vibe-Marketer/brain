import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptExport } from "@/hooks/useTranscriptExport";
import {
  buildObsidianMarkdown,
  buildObsidianVaultPath,
  exportSingleCallToObsidian,
} from "@/lib/export-utils";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/lib/export-utils", () => ({
  buildObsidianMarkdown: vi.fn(() => "OBSIDIAN MARKDOWN"),
  buildObsidianVaultPath: vi.fn(() => "Acme/ALL WORKSPACES/Sales/2026-06-01-call.md"),
  exportSingleCallToObsidian: vi.fn(),
}));

const writeText = vi.fn();

describe("useTranscriptExport Obsidian handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("exports the current call to Obsidian with canonical metadata and resolved source URL", () => {
    const { result } = renderHook(() =>
      useTranscriptExport({
        call: {
          recording_id: "legacy-1",
          canonical_uuid: "11111111-1111-1111-1111-111111111111",
          title: "Obsidian Export",
          created_at: "2026-06-01T12:00:00.000Z",
          recording_start_time: "2026-06-01T12:00:00.000Z",
          recording_end_time: "2026-06-01T12:30:00.000Z",
          full_transcript: "Speaker 1: Body",
          transcript_segments: null,
          summary: "Summary",
          recorded_by_name: "Ada Lovelace",
          recorded_by_email: "ada@example.com",
          calendar_invitees: [{ name: "Grace Hopper", email: "grace@example.com" }],
          source_metadata: { source_url: "https://source.example/call" },
          workspace_name: "Sales",
          tag_names: ["Follow Up"],
        },
        orgName: "Acme Inc",
        workspaceName: "Sales",
        transcripts: [],
        duration: 30,
        includeTimestamps: true,
      }),
    );

    act(() => {
      result.current.handleExportObsidian();
    });

    expect(exportSingleCallToObsidian).toHaveBeenCalledTimes(1);
    expect(exportSingleCallToObsidian).toHaveBeenCalledWith(
      expect.objectContaining({
        canonical_uuid: "11111111-1111-1111-1111-111111111111",
        url: "https://source.example/call",
        tag_names: ["Follow Up"],
        workspace_name: "Sales",
      }),
      { orgName: "Acme Inc", workspaceName: "Sales" },
    );
  });

  it("falls back to the loaded transcripts array when the call has no embedded transcript (fixes 'Transcript not available' in the .md export + clipboard)", () => {
    const { result } = renderHook(() =>
      useTranscriptExport({
        call: {
          recording_id: "rec-9",
          title: "No Embedded Transcript",
          created_at: "2026-06-01T12:00:00.000Z",
          full_transcript: null,
          transcript_segments: null,
          summary: "Summary",
          workspace_name: "Sales",
        },
        orgName: "Acme Inc",
        workspaceName: "Sales",
        transcripts: [
          { timestamp: "0:00", display_text: "Hello there.", display_speaker_name: "Ada" },
          { timestamp: "0:05", display_text: "General Kenobi.", display_speaker_name: "Grace" },
        ],
        duration: 30,
        includeTimestamps: true,
      }),
    );

    act(() => {
      result.current.handleExportObsidian();
    });

    const passedCall = vi.mocked(exportSingleCallToObsidian).mock.calls[0]![0];
    expect(passedCall.full_transcript).toBeTruthy();
    expect(passedCall.full_transcript).toContain("Hello there.");
    expect(passedCall.full_transcript).toContain("General Kenobi.");
  });

  it("copies Obsidian markdown produced from the same builder inputs", async () => {
    const { result } = renderHook(() =>
      useTranscriptExport({
        call: {
          recording_id: "legacy-1",
          canonical_uuid: "11111111-1111-1111-1111-111111111111",
          title: "Obsidian Copy",
          created_at: "2026-06-01T12:00:00.000Z",
          full_transcript: "Speaker 1: Body",
          source_metadata: { share_url: "https://share.example/call" },
          workspace_name: "Sales",
          tag_names: ["Customer Risk"],
        },
        orgName: "Acme Inc",
        workspaceName: "Sales",
        transcripts: [],
        duration: null,
        includeTimestamps: false,
      }),
    );

    await act(async () => {
      await result.current.handleCopyObsidianMarkdown();
    });

    expect(buildObsidianVaultPath).toHaveBeenCalledWith(
      expect.objectContaining({
        canonical_uuid: "11111111-1111-1111-1111-111111111111",
        url: "https://share.example/call",
        tag_names: ["Customer Risk"],
      }),
      "Acme Inc",
      "Sales",
    );
    expect(buildObsidianMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        canonical_uuid: "11111111-1111-1111-1111-111111111111",
        url: "https://share.example/call",
        tag_names: ["Customer Risk"],
      }),
      expect.objectContaining({
        orgName: "Acme Inc",
        workspaceName: "Sales",
        vaultPath: "Acme/ALL WORKSPACES/Sales/2026-06-01-call.md",
      }),
    );
    expect(writeText).toHaveBeenCalledWith("OBSIDIAN MARKDOWN");
  });
});
