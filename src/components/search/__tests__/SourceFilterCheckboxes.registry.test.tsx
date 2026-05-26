import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VISIBLE_SOURCE_REGISTRY } from "@/config/source-registry";
import { SourceFilterCheckboxes } from "../SourceFilterCheckboxes";

describe("SourceFilterCheckboxes registry wiring", () => {
  it("renders every visible source from the canonical source registry", () => {
    render(<SourceFilterCheckboxes selectedSources={[]} onChange={() => undefined} />);

    for (const source of VISIBLE_SOURCE_REGISTRY) {
      expect(screen.getByText(source.label)).toBeInTheDocument();
    }
    expect(screen.queryByText("Grain")).not.toBeInTheDocument();
  });
});
