/**
 * Radix DescriptionWarning regression guard — PR #307.
 *
 * Root cause: a manual id= on <DialogDescription> overrides Radix's auto-generated
 * radix-:rXX: id, causing document.getElementById to miss and DescriptionWarning to fire.
 * Fix: remove the id= + aria-describedby= pair and let Radix own wiring.
 *
 * This test asserts the anti-pattern never returns to any of the affected dialogs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");
const readSrc = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), "utf-8");

const AFFECTED_DIALOGS = [
  // PR #307 scope — src/components/dialogs/
  "src/components/dialogs/CreateOrganizationDialog.tsx",
  "src/components/dialogs/CreateWorkspaceDialog.tsx",
  "src/components/dialogs/DeleteOrganizationDialog.tsx",
  "src/components/dialogs/DeleteWorkspaceDialog.tsx",
  "src/components/dialogs/EditWorkspaceDialog.tsx",
  // Sibling dialogs cleaned up in the same pass
  "src/components/CallDetailDialog.tsx",
  "src/components/EditFolderDialog.tsx",
  "src/components/QuickCreateFolderDialog.tsx",
  "src/components/import/BulkApplyDialog.tsx",
];

describe("Radix DescriptionWarning regression guard", () => {
  for (const file of AFFECTED_DIALOGS) {
    it(`${file} does NOT carry the manual id-override anti-pattern`, () => {
      const src = readSrc(file);
      expect(src, `${file}: found manual id on DialogDescription`).not.toMatch(
        /<DialogDescription[^>]+id=/,
      );
      expect(
        src,
        `${file}: found aria-describedby on DialogContent`,
      ).not.toMatch(/<DialogContent[^>]+aria-describedby=/);
    });
  }
});
