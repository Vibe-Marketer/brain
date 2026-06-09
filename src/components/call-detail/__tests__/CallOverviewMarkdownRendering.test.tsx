import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallOverviewTab } from "../CallOverviewTab";
import type { Meeting } from "@/types";

vi.mock("@/components/ui/tabs", () => ({
  TabsContent: ({ children, ...props }: React.ComponentProps<"div">) =>
    React.createElement("div", { ...props }, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.ComponentProps<"div">) =>
    React.createElement("div", { ...props }, children),
}));

function makeMeeting(overrides: Partial<Meeting>): Meeting {
  return {
    recording_id: "rec-source-preview-1",
    title: "Source Preview Call",
    created_at: "2026-06-09T12:00:00Z",
    summary: "Summary",
    full_transcript: "Transcript",
    source_platform: "loom",
    share_url: "https://www.loom.com/share/abc123",
    ...overrides,
  } as Meeting;
}

describe("CallOverviewTab source preview markdown rendering", () => {
  it("renders source preview markdown as rich text instead of raw markdown", () => {
    render(
      <CallOverviewTab
        call={makeMeeting({
          source_metadata: {
            source_link_metadata: {
              source_url: "https://www.loom.com/share/abc123",
              provider_name: "Loom",
              title: "Raw Markdown Source",
              description: "**Highlights**\n\n- First decision\n- Next action",
            },
          },
        })}
        duration={2}
        callSpeakers={[]}
        callCategories={[]}
        isEditing={false}
        editedSummary=""
        setEditedSummary={vi.fn()}
        sourceApp="loom"
      />,
    );

    expect(screen.getByText("SOURCE PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("Highlights").tagName).toBe("STRONG");
    expect(screen.getByText("First decision").closest("li")).toBeTruthy();
    expect(screen.getByText("Next action").closest("li")).toBeTruthy();
    expect(screen.queryByText(/\*\*Highlights\*\*/)).not.toBeInTheDocument();
  });
});
