/**
 * APPR-03 invariant (14-03): no agent-authored change reaches main through a
 * CI side door. Agent PRs merge ONLY via the autopilot push-gate on an
 * explicit admin approval event (Phase 13/14).
 *
 * This static test pins:
 *  1. auto-merge.yml's job condition excludes agent PRs (label + author).
 *  2. No workflow besides auto-merge.yml contains a merge-capable command.
 *  3. auto-merge.yml still requires the human 'auto-merge' label (the guard
 *     wasn't "satisfied" by deleting the workflow's function).
 *
 * Removing the exclusion guard — or adding a second merge path — fails the
 * suite, which fails CI.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");
const AUTO_MERGE_FILE = "auto-merge.yml";

/** Verified agent identity: the dispatcher's gh CLI login (13-CONTEXT). */
const AGENT_LOGIN = "Vibe-Marketer";

/** Collapse all whitespace so YAML folding/indentation can't dodge assertions. */
function normalized(text: string): string {
  return text.replace(/\s+/g, " ");
}

const autoMergeRaw = readFileSync(join(WORKFLOWS_DIR, AUTO_MERGE_FILE), "utf8");
const autoMerge = normalized(autoMergeRaw);

describe("APPR-03: agent PRs are excluded from auto-merge", () => {
  it("the job condition excludes PRs labeled 'autopilot'", () => {
    expect(autoMerge).toContain(
      "!contains(github.event.pull_request.labels.*.name, 'autopilot')"
    );
  });

  it("the job condition excludes PRs authored by the agent login", () => {
    expect(autoMerge).toContain(
      `github.event.pull_request.user.login != '${AGENT_LOGIN}'`
    );
  });

  it("both exclusions are ANDed into the same if: condition as the trigger", () => {
    // Extract the if: condition block (up to the next job key).
    const ifMatch = autoMerge.match(/if: >- (.*?) runs-on:/);
    expect(ifMatch).not.toBeNull();
    const condition = ifMatch![1];
    expect(condition).toContain("github.event.label.name == 'auto-merge'");
    expect(condition).toContain(
      "!contains(github.event.pull_request.labels.*.name, 'autopilot')"
    );
    expect(condition).toContain(
      `github.event.pull_request.user.login != '${AGENT_LOGIN}'`
    );
    // ANDed, not ORed.
    expect(condition).toContain("&&");
    expect(condition).not.toContain("||");
  });

  it("still requires the human 'auto-merge' label (positive trigger intact)", () => {
    expect(autoMerge).toContain("github.event.label.name == 'auto-merge'");
    // The workflow still does its job: it enables auto-merge for human PRs.
    expect(autoMerge).toContain("gh pr merge");
    expect(autoMerge).toContain("--auto");
  });
});

describe("APPR-03: no merge-capable workflow exists outside auto-merge.yml", () => {
  const MERGE_PATTERNS = [/gh pr merge/, /pulls\.merge/, /merge_method/, /automerge/i];

  it("every workflow containing a merge-capable command is auto-merge.yml itself", () => {
    const workflowFiles = readdirSync(WORKFLOWS_DIR).filter(
      (f) => f.endsWith(".yml") || f.endsWith(".yaml")
    );
    expect(workflowFiles).toContain(AUTO_MERGE_FILE);

    const offenders: string[] = [];
    for (const file of workflowFiles) {
      if (file === AUTO_MERGE_FILE) continue;
      const content = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
      for (const pattern of MERGE_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
