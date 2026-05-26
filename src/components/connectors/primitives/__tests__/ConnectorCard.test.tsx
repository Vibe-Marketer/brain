/**
 * Tests for ConnectorCard primitive + variants.
 *
 * The primitive is a pure presentational component. It pulls metadata from
 * `tryGetSourceConfig(sourceApp)` unless overridden. No useState, no useEffect.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectorCard } from "../ConnectorCard";
import { ConnectorCardSquare } from "../ConnectorCardSquare";
import { ConnectorCardTile } from "../ConnectorCardTile";
import { ConnectorCardRow } from "../ConnectorCardRow";
import { ConnectorCardFull } from "../ConnectorCardFull";

describe("ConnectorCard (base primitive)", () => {
  it("renders the registry label when no override given", () => {
    render(<ConnectorCard sourceApp="fathom" status="connected" />);
    expect(screen.getByText("Fathom")).toBeInTheDocument();
  });

  it("renders an explicit label override over the registry label", () => {
    render(
      <ConnectorCard
        sourceApp="fathom"
        status="connected"
        label="Custom Label"
      />,
    );
    expect(screen.getByText("Custom Label")).toBeInTheDocument();
    expect(screen.queryByText("Fathom")).not.toBeInTheDocument();
  });

  it("renders children slot for variant-specific content", () => {
    render(
      <ConnectorCard sourceApp="zoom" status="connected">
        <span data-testid="extra-content">extra</span>
      </ConnectorCard>,
    );
    expect(screen.getByTestId("extra-content")).toBeInTheDocument();
  });

  it("falls back to the source-app string if registry has no entry", () => {
    render(
      <ConnectorCard sourceApp="totally-fake-source" status="not-connected" />,
    );
    expect(screen.getByText("totally-fake-source")).toBeInTheDocument();
  });

  it("fires onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(
      <ConnectorCard
        sourceApp="fathom"
        status="connected"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render as a button when onClick is omitted", () => {
    render(<ConnectorCard sourceApp="fathom" status="connected" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ConnectorCardSquare", () => {
  it("renders as a 56px button", () => {
    render(
      <ConnectorCardSquare
        sourceApp="fathom"
        status="connected"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("w-14");
    expect(btn.className).toContain("h-14");
  });

  it("uses success ring when connected", () => {
    render(
      <ConnectorCardSquare
        sourceApp="fathom"
        status="connected"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("ring-success");
  });

  it("uses a neutral ring (not destructive) when not connected", () => {
    render(
      <ConnectorCardSquare
        sourceApp="fathom"
        status="not-connected"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).not.toContain("ring-destructive");
  });
});

describe("ConnectorCardTile", () => {
  it("renders a 100px tile", () => {
    render(
      <ConnectorCardTile
        sourceApp="fathom"
        status="connected"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /fathom/i });
    expect(btn.className).toContain("w-[100px]");
  });

  it("renders an on/off toggle when connected and switch handler provided", () => {
    const onSwitchChange = vi.fn();
    render(
      <ConnectorCardTile
        sourceApp="fathom"
        status="connected"
        enabled
        onCardClick={() => {}}
        onSwitchChange={onSwitchChange}
      />,
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("does not use the deprecated 'border-ink-muted' token", () => {
    render(
      <ConnectorCardTile
        sourceApp="fathom"
        status="not-connected"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /fathom/i });
    expect(btn.className).not.toContain("border-ink-muted");
  });
});

describe("ConnectorCardRow", () => {
  it("renders horizontally with label + status", () => {
    render(<ConnectorCardRow sourceApp="fathom" status="connected" />);
    expect(screen.getByText("Fathom")).toBeInTheDocument();
  });

  it("renders an action button when handler provided", () => {
    const onConnect = vi.fn();
    render(
      <ConnectorCardRow
        sourceApp="fathom"
        status="not-connected"
        onConnect={onConnect}
        actionLabel="Connect"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(onConnect).toHaveBeenCalled();
  });
});

describe("ConnectorCardFull", () => {
  it("renders full card with status badge", () => {
    render(
      <ConnectorCardFull
        sourceApp="fathom"
        status="connected"
        callCount={42}
      />,
    );
    expect(screen.getByText("Fathom")).toBeInTheDocument();
    expect(screen.getByText(/42 recordings/i)).toBeInTheDocument();
  });

  it("renders Connect button when disconnected", () => {
    const onConnect = vi.fn();
    render(
      <ConnectorCardFull
        sourceApp="fathom"
        status="not-connected"
        callCount={0}
        onConnect={onConnect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    expect(onConnect).toHaveBeenCalled();
  });
});
