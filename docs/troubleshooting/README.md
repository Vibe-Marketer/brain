# Troubleshooting Documentation

This directory contains comprehensive troubleshooting guides for common issues in CallVault.

---

## Available Guides

### [White Screen Prevention](./white-screen-prevention.md)
**Status:** Complete fix documentation (2025-12-04)
**Commits:** cdf90a8, 9dbb3e1, 31cafce, ad19a27

Comprehensive documentation of all white screen (React crash) issues that were identified and fixed across 15+ components. Includes:
- Root cause analysis
- Defensive coding patterns established
- Component-by-component fix documentation
- Future prevention guidelines
- Debugging methodology

**Use this when:**
- Investigating a new white screen issue
- Learning defensive React patterns
- Understanding array/null validation patterns
- Reviewing code for safety

### [White Screen Fixes - Quick Reference](./white-screen-fixes-quick-ref.md)
**Status:** Quick lookup guide (2025-12-04)

Fast reference for understanding what was fixed in each component. Perfect for:
- Quick component lookup during debugging
- Pattern identification
- Copy-paste examples
- Testing checklist

**Use this when:**
- You know the component but need to understand the fix
- Looking for a specific pattern example
- Need a quick testing checklist

---

## Troubleshooting Workflow

### Step 1: Identify the Issue Type

**White Screen / React Crash:**
→ See [white-screen-prevention.md](./white-screen-prevention.md)

**Performance Issues:**
→ (Documentation pending)

**API/Database Errors:**
→ (Documentation pending)

**Build/TypeScript Errors:**
→ (Documentation pending)

**UI/Design Issues:**
→ See [../design/brand-guidelines-v3.3.md](../design/brand-guidelines-v3.3.md)

### Step 2: Follow the Guide

Each troubleshooting guide includes:
- Symptoms identification
- Debugging methodology
- Common causes
- Fix patterns
- Prevention guidelines

### Step 3: Document New Issues

If you encounter a new category of issue:
1. Create a new guide following the same structure
2. Update this README with a link
3. Add to the workflow above

---

## Common Debugging Tools

### Browser DevTools
- **Console:** Error messages and stack traces
- **React DevTools:** Component state inspection
- **Network:** API request/response debugging

### VS Code Extensions
- **TypeScript:** Type checking and IntelliSense
- **ESLint:** Code quality warnings
- **Error Lens:** Inline error display

### CLI Commands
```bash
# Type checking
npm run type-check

# Build verification
npm run build

# Dev server with hot reload
npm run dev
```

---

## Related Documentation

- [Brand Guidelines](../design/brand-guidelines-v3.3.md) - UI/design standards
- [API Naming Conventions](../architecture/api-naming-conventions.md) - Code naming
- [ADR Index](../adr/README.md) - Architecture decisions
- [CLAUDE.md](../../CLAUDE.md) - Development guide

---

## Contributing to Troubleshooting Docs

When creating new troubleshooting documentation:

### Required Sections
1. **Overview** - What this issue is
2. **Symptoms** - How to identify it
3. **Root Cause** - Why it happens
4. **Debugging Steps** - How to investigate
5. **Fix Patterns** - How to resolve
6. **Prevention** - How to avoid in future

### Best Practices
- Include code examples (before/after)
- Reference specific file paths and line numbers
- Link to related documentation
- Add date and commit references
- Keep quick reference separate from detailed docs

---

**END OF TROUBLESHOOTING INDEX**
