import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

function readSrc(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

describe("WorkspaceSidebarPane navigation tree regressions", () => {
  it("does not render an empty folder placeholder under folderless workspaces", () => {
    const src = readSrc("src/components/panes/WorkspaceSidebarPane.tsx");

    expect(src).not.toContain("No folders");
    expect(src).toContain("{folders.length > 0 && (");
  });

  it("lets workspace rows and chevrons collapse without a double toggle", () => {
    const src = readSrc("src/components/panes/WorkspaceSidebarPane.tsx");
    const triggerStart = src.indexOf("<Collapsible.Trigger asChild>");
    const triggerEnd = src.indexOf("</Collapsible.Trigger>", triggerStart);
    const triggerBlock = src.slice(triggerStart, triggerEnd);

    expect(src).toContain("setIsOpen((open) => !open);");
    expect(triggerBlock).not.toContain("setIsOpen");
  });

  it("keeps sortable workspace rows constrained to the pane width", () => {
    const paneSrc = readSrc("src/components/panes/WorkspaceSidebarPane.tsx");
    const dropZoneSrc = readSrc("src/components/dnd/WorkspaceDropZone.tsx");

    expect(paneSrc).toContain("group/sortable rounded-lg w-full min-w-0 overflow-hidden");
    expect(dropZoneSrc).toContain("w-full min-w-0 overflow-hidden rounded-lg");
  });
});
