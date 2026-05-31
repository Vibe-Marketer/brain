---
captured: 2026-05-31
captured_by: Claude under Andrew's direction
scope: GitHub Actions workflow security posture
methodology: file grep + workflow inspection (read-only)
trust_services_criteria: ["CC7.1", "CC8.1", "CC9.2"]
---

# GitHub Actions Security Audit

> Supply-chain and permission posture across `.github/workflows/`. 9 workflow files reviewed.

## Workflow inventory

| File | Purpose |
|------|---------|
| `auto-merge.yml` | Automated PR merging |
| `ci.yml` | Build + test pipeline |
| `claude.yml` | Claude Code automation |
| `deploy-edge-functions.yml` | Supabase Edge Function deploys |
| `security.yml` | TruffleHog secret scanning + Claude Code security review + dependency review |
| `sentry-autofix.yml` | Sentry autofix integration |
| `sentry-deploy.yml` | Sentry release tracking |
| `uptime.yml` | Uptime monitoring |
| `TROUBLESHOOTING.md` | Developer doc, not a workflow |

## Action version pinning

| Workflow | Version pinning | Risk |
|----------|------------------|------|
| auto-merge.yml | `actions/github-script@v7` | ⚠️ MAJOR tag (mutable) |
| ci.yml | all `@v4` (checkout, setup-node, upload-artifact) | ⚠️ MAJOR tag (mutable) |
| claude.yml | `actions/checkout@v4`, `anthropics/claude-code-action@v1` | ⚠️ MAJOR tag |
| deploy-edge-functions.yml | `actions/checkout@v4`, `supabase/setup-cli@v1` | ⚠️ MAJOR tag |
| security.yml | `denoland/setup-deno@v2`, `actions/dependency-review-action@v3`, **`trufflesecurity/trufflehog@main`, `anthropics/claude-code-security-review@main`** | 🔴 **`@main` floating refs — these can change on any upstream push** |
| sentry-autofix.yml | `actions/github-script@v7` | ⚠️ MAJOR tag |
| sentry-deploy.yml | `actions/checkout@v4` | ⚠️ MAJOR tag |
| uptime.yml | `actions/github-script@v7` | ⚠️ MAJOR tag |

### Severity recommendations

| Priority | Action | Why |
|----------|--------|-----|
| 🔴 **High** | Pin `trufflesecurity/trufflehog@main` and `anthropics/claude-code-security-review@main` to specific commit SHAs | `@main` is a moving target. If either upstream is compromised, the next workflow run pulls the malicious code with read access to the entire repo and secret scanning context. |
| 🟡 **Medium** | Pin remaining MAJOR-tag (`@v4`, `@v7`, etc.) to commit SHAs | MAJOR tags are reassignable by the action publisher. Recommended best practice per OpenSSF Scorecard + GitHub's own security hardening guide. Commit SHA pinning + Dependabot's action-version-update rules together provide both safety and easy upgrades. |
| 🟢 Low | Add OpenSSF Scorecard analysis | Reports overall workflow health; informational only |

The Medium-priority pinning is a known tradeoff: tighter security vs more manual upgrade work. At single-principal stage, leaving major-tag pinning is defensible — but the two `@main` refs in `security.yml` should be tightened immediately.

## Permissions blocks

| Workflow | Permissions block | Assessment |
|----------|-------------------|------------|
| auto-merge.yml | ❌ None | Inherits broad default permissions |
| ci.yml | ❌ None | Inherits broad default permissions |
| claude.yml | ❌ None | Likely needs write access for Claude PR comments; should be explicit |
| deploy-edge-functions.yml | ✅ `contents: read` | Properly scoped |
| security.yml | ✅ `pull-requests: write`, `contents: read` | Properly scoped |
| sentry-autofix.yml | ❌ None | Inherits broad default |
| sentry-deploy.yml | ❌ None | Inherits broad default |
| uptime.yml | ✅ `contents: read`, `issues: write` | Properly scoped |

### Recommendation

Add a top-level `permissions:` block to every workflow following least-privilege principle. The pattern:

```yaml
permissions:
  contents: read    # minimum needed to checkout the repo
```

Then add specific elevated permissions ONLY where needed (e.g., `issues: write` for workflows that create issues, `pull-requests: write` for workflows that comment on PRs).

Default GitHub permissions grant the `GITHUB_TOKEN` write access to nearly everything — overly broad for routine CI tasks.

## Secret handling in workflows

Sampled grep for explicit secrets in workflow files: no hardcoded secrets found. All secret references use `${{ secrets.* }}` correctly.

## OIDC opportunity

Workflows that deploy to external services (Supabase, Vercel, Sentry) currently use long-lived API tokens stored in GitHub Actions secrets. A future hardening pass could migrate to OIDC where supported:
- **Supabase:** OIDC not directly supported as of capture date; long-lived token is current best option
- **Vercel:** OIDC supported for some flows; worth investigation
- **Sentry:** API key remains standard

Not blocking; informational.

## Recommended remediation set (compact)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 1 | Pin `trufflesecurity/trufflehog@main` to a specific commit SHA | Andrew | 5 min |
| 2 | Pin `anthropics/claude-code-security-review@main` to a specific commit SHA | Andrew | 5 min |
| 3 | Add `permissions: contents: read` to: `auto-merge.yml`, `ci.yml`, `claude.yml`, `sentry-autofix.yml`, `sentry-deploy.yml` (escalate as needed per workflow) | Andrew or Claude | 15 min |
| 4 | Optional: enable Dependabot version updates for GitHub Actions (covers floating-version drift detection) | Andrew | 2 min |

## Net assessment

**CC7.1 (vulnerability management — supply chain dimension)** — PARTIAL → MET after the two `@main` pins are fixed.
**CC8.1 (change management — CI/CD dimension)** — MET; well-structured workflow library with proper test gates.
**CC9.2 (vendor risk — supply chain)** — MET with caveat about action-pinning practice.

Net: workflow library is healthy. Two specific tight-now actions (pin the `@main` refs) close the highest-risk supply-chain surface. Adding permissions blocks to 5 workflows is best-practice polish.
