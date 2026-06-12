#!/usr/bin/env node
/**
 * Baseline-gated TypeScript check (ticket 3d68d1cd).
 *
 * The root tsconfig.json uses `"files": []` + project references, so a bare
 * `tsc --noEmit` checks ZERO files. This script runs the real per-project
 * checks (tsconfig.app.json, plus tsconfig.node.json when present) and gates
 * on NEW errors only, tolerating the committed baseline of legacy errors.
 *
 * Error identity is stable across line drift: file path + TS code + a hash of
 * the normalized first message line (NOT line/column numbers). The baseline
 * stores a count per key, so introducing an additional instance of an
 * already-baselined error in the same file is still caught.
 *
 * Usage:
 *   node scripts/type-check.mjs                  # gate: exit 1 on NEW errors
 *   node scripts/type-check.mjs --update-baseline # rewrite type-baseline.json
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'type-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

// ── Projects to check ────────────────────────────────────────────────────────
const projects = ['tsconfig.app.json'];
const nodeTsconfig = path.join(ROOT, 'tsconfig.node.json');
if (existsSync(nodeTsconfig)) {
  try {
    const raw = readFileSync(nodeTsconfig, 'utf8').trim();
    if (raw.length > 0 && raw !== '{}') projects.push('tsconfig.node.json');
  } catch {
    /* unreadable -> skip */
  }
}

// ── Run tsc and parse errors ─────────────────────────────────────────────────
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
// Matches `--pretty false` output: path(line,col): error TScode: message
const ERROR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function runProject(project) {
  // Guard: tsc must actually be installed. Without this, a missing node_modules
  // (e.g. a fresh worktree) lets `node` launch but tsc throw MODULE_NOT_FOUND —
  // its stack trace doesn't match ERROR_RE, so zero errors parse and the gate
  // reports a FALSE PASS (ticket 99d7e5ca). Fail hard instead.
  if (!existsSync(TSC)) {
    console.error(`FATAL: tsc not found at ${TSC}. Dependencies are not installed — run \`npm ci\` before the type-check gate.`);
    process.exit(2);
  }
  const res = spawnSync(process.execPath, [TSC, '-p', project, '--noEmit', '--pretty', 'false'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    console.error(`FATAL: failed to spawn tsc for ${project}: ${res.error.message}`);
    process.exit(2);
  }
  const errors = [];
  for (const line of `${res.stdout}\n${res.stderr}`.split('\n')) {
    const m = ERROR_RE.exec(line.trimEnd());
    if (m) {
      const [, file, lineNo, , code, message] = m;
      errors.push({ project, file: file.replaceAll('\\', '/'), line: Number(lineNo), code, message });
    }
  }
  // Version-robust crash check: tsc exits 0 when clean and non-zero when it
  // finds type errors (exact code varies by version — 1 or 2), but in that case
  // it ALWAYS prints diagnostics ERROR_RE matches. So a non-zero exit that
  // produced ZERO parsed diagnostics means tsc crashed (missing deps, bad
  // tsconfig) — NOT a clean run. Fail hard so the gate can never mistake "the
  // checker didn't run" for "no errors" (ticket 99d7e5ca).
  if (res.status !== 0 && errors.length === 0) {
    console.error(
      `FATAL: tsc for ${project} exited ${res.status} with no diagnostics — ` +
      `the type checker did not run correctly (deps missing? bad tsconfig?).`,
    );
    const errTail = (res.stderr ?? '').trim();
    if (errTail) console.error(errTail.split('\n').slice(0, 6).join('\n'));
    process.exit(2);
  }
  return errors;
}

function keyOf(err) {
  // Normalize message: collapse whitespace so formatting tweaks don't churn keys.
  const normalized = err.message.replace(/\s+/g, ' ').trim();
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  return `${err.file}|${err.code}|${hash}`;
}

const allErrors = projects.flatMap(runProject);

// key -> { count, sample } ; baseline file stores key -> count (+ meta)
const current = new Map();
for (const err of allErrors) {
  const k = keyOf(err);
  const entry = current.get(k) ?? { count: 0, sample: err };
  entry.count += 1;
  current.set(k, entry);
}

// ── --update-baseline ────────────────────────────────────────────────────────
if (UPDATE) {
  const errors = {};
  for (const k of [...current.keys()].sort()) {
    const { count, sample } = current.get(k);
    errors[k] = { count, code: sample.code, message: sample.message };
  }
  const baseline = {
    $comment:
      'Committed type-error baseline (ticket 3d68d1cd). Keys are file|TScode|message-hash (line numbers excluded — they drift). npm run type-check fails only on NEW errors. Shrink via: node scripts/type-check.mjs --update-baseline after burn-down batches.',
    generatedAt: new Date().toISOString(),
    projects,
    totalErrors: allErrors.length,
    errors,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written: ${allErrors.length} errors (${current.size} unique keys) -> ${path.relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

// ── Gate mode ────────────────────────────────────────────────────────────────
if (!existsSync(BASELINE_PATH)) {
  console.error('FATAL: type-baseline.json not found. Generate it with:');
  console.error('  node scripts/type-check.mjs --update-baseline');
  process.exit(1);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (e) {
  console.error(`FATAL: could not parse type-baseline.json: ${e.message}`);
  process.exit(1);
}
const baselineErrors = baseline.errors ?? {};

const newErrors = []; // { key, sample, count, allowed }
let baselineRemaining = 0;
for (const [k, entry] of current) {
  const allowed = baselineErrors[k]?.count ?? 0;
  if (entry.count > allowed) {
    newErrors.push({ key: k, ...entry, allowed });
    baselineRemaining += allowed;
  } else {
    baselineRemaining += entry.count;
  }
}

const fixedKeys = Object.keys(baselineErrors).filter((k) => !current.has(k));
const baselineTotal = Object.values(baselineErrors).reduce((s, e) => s + (e.count ?? 0), 0);

if (newErrors.length > 0) {
  console.error(`TYPE CHECK FAILED: ${newErrors.length} NEW error key(s) not in baseline:\n`);
  for (const ne of newErrors.sort((a, b) => a.key.localeCompare(b.key))) {
    const extra = ne.allowed > 0 ? ` (count ${ne.count} > baseline ${ne.allowed})` : '';
    const occurrences = allErrors
      .filter((e) => keyOf(e) === ne.key)
      .map((e) => `${e.file}(${e.line})`)
      .join(', ');
    console.error(`  ${ne.sample.code} ${ne.sample.file}${extra}`);
    console.error(`    ${ne.sample.message}`);
    console.error(`    at: ${occurrences}`);
  }
  console.error(`\nBaseline errors still present: ${baselineRemaining}/${baselineTotal}.`);
  console.error('Fix the new errors above. If a fix legitimately reduces the baseline, run:');
  console.error('  node scripts/type-check.mjs --update-baseline');
  process.exit(1);
}

console.log(`TYPE CHECK PASSED: 0 new errors.`);
console.log(`Baseline errors remaining: ${baselineRemaining}/${baselineTotal} (projects: ${projects.join(', ')}).`);
if (fixedKeys.length > 0) {
  console.log(`Nice: ${fixedKeys.length} baseline error key(s) no longer occur. Shrink the baseline with:`);
  console.log('  node scripts/type-check.mjs --update-baseline');
}
process.exit(0);
