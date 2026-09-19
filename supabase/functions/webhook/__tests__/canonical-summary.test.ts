import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Evaluate the actual object passed to runPipeline. This catches a summary
// stored only in source_metadata, which the canonical recordings writer does
// not use as a fallback. No mocked database or duplicate mapper implementation.
function webhookPipelineRecord(summary: string | null): Record<string, unknown> {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/webhook/index.ts"), "utf8");
  const ast = ts.createSourceFile("webhook.ts", source, ts.ScriptTarget.Latest, true);
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "runPipeline") {
      expression = node.arguments[2];
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!expression) throw new Error("Webhook runPipeline record was not found");
  const code = ts.transpileModule(`const record = ${expression.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const evaluate = new Function("meeting", "fullTranscript", "summary", "durationSeconds", "participantEmails", "connectorWorkspaceId", `${code}\nreturn record;`);
  return evaluate({ recording_id: 12345, title: "Call", recording_start_time: "2026-07-28T13:00:00Z" }, "[0:00] John: Hello.", summary, 1800, [], null);
}

describe("Fathom webhook canonical summary", () => {
  it("passes the provider's parsed summary to the canonical recordings column", () => {
    const record = webhookPipelineRecord("## Decisions\nKeep the complete source summary.");
    expect(record.summary).toBe("## Decisions\nKeep the complete source summary.");
    expect(record.full_transcript).toBe("[0:00] John: Hello.");
    expect(record.source_metadata).toMatchObject({ summary: record.summary, import_source: "webhook" });
  });

  it("passes null when the provider has no summary", () => {
    expect(webhookPipelineRecord(null).summary).toBeNull();
  });
});
