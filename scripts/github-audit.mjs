#!/usr/bin/env node
// GitHub housekeeping audit. Iterates Vibe-Marketer repos and checks invariants.
// Usage: GITHUB_TOKEN=... ORG=Vibe-Marketer node scripts/github-audit.mjs

const ORG = process.env.ORG || "Vibe-Marketer";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN");
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function gh(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return { ok: false, status: 404, data: null };
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, data: null, error: text };
  }
  return { ok: true, status: res.status, data: await res.json() };
}

async function paginate(path) {
  const out = [];
  let url = `${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  while (url) {
    const res = await fetch(`https://api.github.com${url}`, { headers: H });
    if (!res.ok) break;
    const page = await res.json();
    out.push(...page);
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1].replace("https://api.github.com", "") : null;
  }
  return out;
}

const checks = [
  {
    key: "readme",
    label: "README",
    run: async (r) => (await gh(`/repos/${r.full_name}/readme`)).ok,
  },
  {
    key: "license",
    label: "License",
    run: async (r) => !!r.license,
  },
  {
    key: "codeowners",
    label: "CODEOWNERS",
    run: async (r) => {
      const a = await gh(`/repos/${r.full_name}/contents/.github/CODEOWNERS`);
      const b = a.ok ? a : await gh(`/repos/${r.full_name}/contents/CODEOWNERS`);
      return b.ok;
    },
  },
  {
    key: "main_protected",
    label: "main protected",
    run: async (r) => {
      const rs = await gh(`/repos/${r.full_name}/rulesets`);
      const hasRuleset = rs.ok && Array.isArray(rs.data) && rs.data.some(
        (x) => x.enforcement === "active" && x.target === "branch"
      );
      if (hasRuleset) return true;
      const bp = await gh(`/repos/${r.full_name}/branches/${r.default_branch || "main"}/protection`);
      return bp.ok;
    },
  },
  {
    key: "vuln_alerts",
    label: "Vuln alerts",
    run: async (r) => {
      const res = await fetch(
        `https://api.github.com/repos/${r.full_name}/vulnerability-alerts`,
        { headers: H }
      );
      return res.status === 204;
    },
  },
  {
    key: "secret_scanning",
    label: "Secret scanning",
    run: async (r) => r.security_and_analysis?.secret_scanning?.status === "enabled",
  },
  {
    key: "open_dependabot",
    label: "0 open Dependabot",
    run: async (r) => {
      const res = await gh(`/repos/${r.full_name}/dependabot/alerts?state=open&per_page=1`);
      if (!res.ok) return null;
      return Array.isArray(res.data) && res.data.length === 0;
    },
  },
];

function cell(v) {
  if (v === true) return "✓";
  if (v === false) return "✗";
  return "—";
}

async function listRepos() {
  const acct = await gh(`/users/${ORG}`);
  if (!acct.ok) throw new Error(`Account ${ORG} not found`);
  if (acct.data.type === "Organization") {
    return paginate(`/orgs/${ORG}/repos?type=all`);
  }
  // User account — /user/repos returns all (public + private) when authed as that user.
  const own = await gh(`/user`);
  if (own.ok && own.data.login.toLowerCase() === ORG.toLowerCase()) {
    return paginate(`/user/repos?affiliation=owner&visibility=all`);
  }
  return paginate(`/users/${ORG}/repos?type=all`);
}

async function main() {
  console.error(`Auditing ${ORG}…`);
  const repos = (await listRepos()).filter((r) => !r.archived);
  console.error(`Found ${repos.length} non-archived repos`);

  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# GitHub Housekeeping Audit — ${ORG}`);
  lines.push(``);
  lines.push(`**Generated:** ${today}  •  **Repos audited:** ${repos.length}`);
  lines.push(``);
  lines.push(`| Repo | Visibility | ${checks.map((c) => c.label).join(" | ")} |`);
  lines.push(`|---|---|${checks.map(() => "---").join("|")}|`);

  const summary = {};
  for (const c of checks) summary[c.key] = { pass: 0, fail: 0, unknown: 0 };

  for (const repo of repos) {
    const cells = [];
    for (const c of checks) {
      const result = await c.run(repo).catch(() => null);
      if (result === true) summary[c.key].pass++;
      else if (result === false) summary[c.key].fail++;
      else summary[c.key].unknown++;
      cells.push(cell(result));
    }
    const vis = repo.visibility === "private" ? "🔒" : "🌐";
    lines.push(`| \`${repo.name}\` | ${vis} | ${cells.join(" | ")} |`);
  }

  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Check | Pass | Fail | Unknown |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const c of checks) {
    const s = summary[c.key];
    lines.push(`| ${c.label} | ${s.pass} | ${s.fail} | ${s.unknown} |`);
  }

  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
