import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceInfoSection } from "../SourceInfoSection";

describe("SourceInfoSection", () => {
  it("renders canonical source metadata when no raw source table data exists", () => {
    render(
      <SourceInfoSection
        sourceApp="read-ai"
        rawData={null}
        sourceMetadata={{
          read_ai_meeting_id: "meeting-1",
          read_ai_report_url: "https://app.read.ai/report/meeting-1",
          read_ai_live_enabled: true,
          read_ai_topics: ["pricing", "next steps"],
          read_ai_metrics: { ignored: true },
        }}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Meeting Id")).toBeInTheDocument();
    expect(screen.getByText("meeting-1")).toBeInTheDocument();
    expect(screen.getByText("Report Url")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "https://app.read.ai/report/meeting-1",
      }),
    ).toHaveAttribute("href", "https://app.read.ai/report/meeting-1");
    expect(screen.getByText("Live Enabled")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("pricing, next steps")).toBeInTheDocument();
    expect(screen.queryByText("Metrics")).not.toBeInTheDocument();
  });

  it("keeps the empty state when neither raw data nor displayable metadata exists", () => {
    render(
      <SourceInfoSection
        sourceApp="grain"
        rawData={null}
        sourceMetadata={{ grain_ai_action_items: [{ text: "nested" }] }}
        isLoading={false}
      />,
    );

    expect(screen.getByText("No source details available")).toBeInTheDocument();
  });
});
